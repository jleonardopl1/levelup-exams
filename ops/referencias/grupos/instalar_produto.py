#!/usr/bin/env python3
"""Instala e verifica as referências de produto em um diretório externo ao LevelUp.

A partir da raiz do projeto: python3 ops/referencias/grupos/instalar_produto.py
    --dest ../levelup-referencias [--repo dono/nome]
Cada localPath do manifesto é relativo a --dest e contém os ativos do laboratório.
O instalador grava em pastas de item novas. Em pastas preexistentes, confere as
fontes e os artefatos sem executar seus programas nem regravá-los.
O subdiretório source serve para análise local; a licença do item rege a reutilização.
Para developer-roadmap a receita registra somente um link autorizado.
Requer Linux, Git, Python 3.11+ com venv e SQLite deserialize, Node.js e npm.
"""

import argparse
from contextlib import closing, contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import time
import tempfile
from zipfile import ZipFile

MANIFEST = Path(__file__).with_name("produto.json")
PROJECT = Path(__file__).resolve().parents[3]


def run(args, **kwargs):
    return subprocess.run([str(value) for value in args], check=True, text=True, **kwargs)


def git_transfer(args, **kwargs):
    for attempt in range(3):
        try:
            run(args, stderr=subprocess.PIPE, **kwargs)
            return
        except subprocess.CalledProcessError as error:
            message = error.stderr or ""
            print(message, file=sys.stderr, end="")
            transient = re.search(r"50[234]|timed? ?out|connection (?:timeout|reset)|early EOF", message, re.I)
            if not transient or attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))


def checkout(item, source):
    expected = item["sha"]
    remote = f"https://github.com/{item['repo']}.git"
    git = ["git", "-C", source]
    if not re.fullmatch(r"[0-9a-f]{40}", expected):
        raise ValueError(f"Commit inválido em {item['repo']}")
    source.mkdir()
    run([*git, "init", "-q", "-b", "pin"])
    run([*git, "remote", "add", "origin", remote])
    git_transfer([*git, "fetch", "-q", "--no-tags", "--depth=1", "--filter=blob:none", "origin", expected])
    run([*git, "update-ref", "refs/heads/pin", expected])
    paths = "".join(f"/{path}\n" for path in item["checkoutPaths"])
    git_transfer([*git, "sparse-checkout", "set", "--no-cone", "--stdin"], input=paths)
    git_transfer([*git, "read-tree", "-mu", "HEAD"])


def python_env(base, packages, module_path, label):
    venv = base / ".venv"
    run([sys.executable, "-m", "venv", "--copies", venv])
    python = venv / "bin/python"
    run([python, "-m", "pip", "--disable-pip-version-check", "install", "--no-cache-dir", *packages])
    site = run([python, "-c", "import sysconfig; print(sysconfig.get_path('purelib'))"],
               capture_output=True).stdout.strip()
    (Path(site) / f"levelup-{label}.pth").write_text(f"{module_path}\n", encoding="utf-8")
    return python


def deep(base, source):
    python = python_env(base, ["pydantic==2.12.5", "pytest==8.4.2"], source, "deeptutor")
    run([python, "-m", "pytest", "-c", "/dev/null", "--noconftest", "-q",
         source / "deeptutor/learning/tests/test_scheduler.py"],
        env={**os.environ, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"})
    run([python, "-c", """
from deeptutor.learning.mastery import compute_mastery
assert [compute_mastery([True] * n) for n in range(4)] == [0, 0.5, 0.8, 1]
"""])


def skills(base, source):
    root = base / "instalado/.agents/skills"
    for name in ("teach", "grill-me", "grilling"):
        target = root / name
        shutil.copytree(source / "skills/productivity" / name, target)
        shutil.copy2(source / "LICENSE", target / "LICENSE")
        content = (target / "SKILL.md").read_text(encoding="utf-8")
        if not re.search(rf"^name: {re.escape(name)}$", content, re.M):
            raise ValueError(f"Metadados inválidos para {name}")
        for filename in re.findall(r'\]\(\./([A-Z-]+\.md)\)', content):
            if not (target / filename).is_file():
                raise ValueError(f"Documento ausente: {filename}")
    print("3 habilidades verificadas")


def voice(base, source):
    python = python_env(base, [source / "cli", "num2words==0.5.14"], source / "backend", "voicestudio")
    run([python.with_name("voicestudio"), "--help"], capture_output=True)
    run([python, "-c", """
import ast
from importlib.metadata import version
from pathlib import Path
import sys
from services.text_normalization import normalize_text

tree = ast.parse(Path(sys.argv[1]).read_text(encoding="utf-8"))
checked = 0
for assignment in tree.body:
    if not isinstance(assignment, ast.Assign):
        continue
    target = assignment.targets[0]
    if not isinstance(target, ast.Name) or target.id not in ("_CHANGE_CASES", "_UNCHANGED_CASES"):
        continue
    for row in assignment.value.elts:
        language = ast.literal_eval(row.elts[0])
        if language not in ("Portuguese", "pt-BR"):
            continue
        values = tuple(ast.literal_eval(field) for field in row.elts)
        expected = values[-1] if len(values) == 3 else values[1]
        assert normalize_text(values[1], language) == expected, values
        assert normalize_text(expected, language) == expected, values
        checked += 1
assert checked > 0
print(f"CLI {version('voicestudio-cli')}; {checked} casos de português")
""", source / "tests/test_text_normalization.py"])


EXAM_CHECK = """
const assert = require("node:assert/strict");
const { generateRandomExam, createExamResults } = require(process.argv[1]);
const answer = id => ({ id, answer: id, deprecated: false });
const question = {
  id: "q", question: "Questão original de teste", deprecated: false,
  correctAnswers: [answer("c"), { ...answer("excluded"), deprecated: true }],
  wrongAnswers: ["d1", "d2", "d3", "d4"].map(answer)
};
const exam = {
  questions: [question, { ...question, id: "old", deprecated: true }],
  numberOfQuestionsInExam: 1, passingPercent: 70
};
const [generated] = generateRandomExam(exam);
assert.equal(generated.id, "q");
assert.deepEqual(generated.answers.map(a => a.id).sort(), ["c", "d1", "d2", "d3", "d4"]);
assert.ok(generated.answers.every(a => Object.keys(a).sort().join(",") === "answer,id"));
function grade(id, choice) {
  return createExamResults({ userExamQuestions: [{ id, answer: { id: choice } }],
    examTimeInSeconds: 15 }, exam);
}
assert.equal(grade("q", "c").percentCorrect, 100);
assert.equal(grade("q", "c").passed, true);
assert.equal(grade("q", "d1").percentCorrect, 0);
assert.equal(grade("q", "d1").passed, false);
assert.throws(() => grade("inexistente", "c"), /Could not find exam question/);
console.log("Sorteio, filtragem e correção verificados");
"""


def exams(base, source):
    tools = base / "toolchain"
    run(["npm", "install", "--prefix", tools, "--cache", tools / ".cache",
         "--no-audit", "--no-fund", "--ignore-scripts", "--save-exact", "esbuild@0.25.12"])
    output = base / "instalado/provas.cjs"
    output.parent.mkdir(exist_ok=True)
    shuffle = source / "packages/shared/src/utils/shuffle-array.ts"
    run([tools / "node_modules/.bin/esbuild", source / "api/src/utils/exam.ts", "--bundle",
         "--platform=node", "--format=cjs", f"--outfile={output}",
         f"--alias:@freecodecamp/shared/utils/shuffle-array={shuffle}"])
    shutil.copy2(source / "LICENSE.md", output.parent / "LICENSE.md")
    run(["node", "-e", EXAM_CHECK, output])


def matches(path, pattern):
    count = len(re.findall(pattern, path.read_text(encoding="utf-8"), re.MULTILINE))
    if not count:
        raise ValueError(f"Nenhuma entrada em {path}")
    print(f"{path.name}: {count}")
    return count


def decks(source):
    paths = sorted((source / "resources/flash_cards").glob("*.apkg"))
    if len(paths) != 3:
        raise ValueError("Pacotes Anki esperados ausentes")
    for path in paths:
        with ZipFile(path) as archive, closing(sqlite3.connect(":memory:")) as connection:
            connection.deserialize(archive.read("collection.anki2"))
            count, = connection.execute("SELECT count(*) FROM cards").fetchone()
            if not count:
                raise ValueError(f"Sem cartões em {path}")
            print(f"{path.name}: {count} cartões")


def shortcut(item):
    return f"[InternetShortcut]\nURL=https://github.com/{item['repo']}/tree/{item['sha']}\n".encode()


def install_new(item, base):
    name = item["localPath"]
    source = base / "source"
    if name == "developer-roadmap":
        with (base / "referencia.url").open("xb") as output:
            output.write(shortcut(item))
        print("Link externo registrado. Licença limitada a uso pessoal.")
        return
    checkout(item, source)
    check_sources(item, source)
    if name == "deeptutor":
        deep(base, source)
    elif name == "mattpocock-skills":
        skills(base, source)
    elif name == "voicestudio":
        voice(base, source)
    elif name == "freecodecamp":
        exams(base, source)
    elif name == "coding-interview-university":
        matches(source / "translations/README-ptbr.md", r"^\s*- \[ \]")
    elif name == "system-design-primer":
        decks(source)
    elif name == "project-based-learning":
        result = run([sys.executable, "scripts/check_readme.py", "lint", "--json"], cwd=source, capture_output=True)
        print(json.dumps(json.loads(result.stdout)["stats"], ensure_ascii=False))
    elif name == "build-your-own-x":
        matches(source / "README.md", r"^#### Build your own")
    elif name == "free-programming-books":
        for path in ("books/free-programming-books-pt_BR.md", "courses/free-courses-pt_BR.md"):
            matches(source / path, r"^\* \[.+\]\(https?://")
    else:
        raise ValueError(f"Referência não reconhecida: {name}")


def guarded(path):
    """Recusa inclusive um link quebrado ou um link em qualquer diretório ancestral."""
    for part in (*reversed(path.parents), path):
        if part.is_symlink():
            raise ValueError(f"Link simbólico no destino: {part}")
    return path


def regular(path):
    path = guarded(path)
    if not stat.S_ISREG(path.stat().st_mode):
        raise ValueError(f"Arquivo comum esperado: {path}")
    return path.read_bytes()


def check_sources(item, source):
    git_dir = guarded(source / ".git")
    if not git_dir.is_dir():
        raise ValueError(f"Checkout esperado: {source}")
    for directory, dirs, files in os.walk(git_dir):
        if any((Path(directory) / entry).is_symlink() for entry in dirs + files):
            raise ValueError(f"Link simbólico nos metadados Git: {directory}")
    git = ["git", "--no-optional-locks", "--no-replace-objects", "-C", source]
    env = {**os.environ, "GIT_NO_LAZY_FETCH": "1", "GIT_TERMINAL_PROMPT": "0"}
    origin = run([*git, "config", "--local", "--no-includes", "--get", "remote.origin.url"],
                 env=env, capture_output=True).stdout.strip()
    head = run([*git, "rev-parse", "--verify", "HEAD"], env=env, capture_output=True).stdout.strip()
    if head != item["sha"] or origin != f"https://github.com/{item['repo']}.git":
        raise ValueError(f"Origem ou commit divergente: {source}")
    paths = list(item["sourcePaths"])
    if item["localPath"] == "mattpocock-skills":
        paths.extend(f"skills/productivity/{name}" for name in ("teach", "grill-me", "grilling"))
    tree = run([*git, "ls-tree", "-r", "-z", head, "--", *paths], env=env, capture_output=True).stdout
    files = {}
    for row in tree.split("\0"):
        if not row:
            continue
        meta, relative = row.split("\t", 1)
        mode, kind, oid = meta.split()
        if mode not in ("100644", "100755") or kind != "blob":
            raise ValueError(f"Fonte inesperada no commit: {relative}")
        data = regular(source / relative)
        digest = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        if digest != oid:
            raise ValueError(f"Arquivo alterado no checkout: {relative}")
        files[relative] = data
    if not set(item["sourcePaths"]).issubset(files):
        raise ValueError(f"Faltam fontes no checkout: {source}")
    return files


def check_python(base, name):
    venv = base / ".venv"
    regular(venv / "pyvenv.cfg")
    libs = guarded(venv / "lib")
    sites = [entry / "site-packages" for entry in libs.iterdir() if re.fullmatch(r"python3\.\d+", entry.name)]
    if len(sites) != 1:
        raise ValueError(f"Ambiente Python incompleto ou ambíguo: {venv}")
    site = sites[0]
    source = base / "source"
    if name == "deeptutor":
        command, packages = "pytest", ("pydantic-2.12.5", "pytest-8.4.2")
    else:
        command, packages = "voicestudio", ("voicestudio_cli-0.5.9b6", "num2words-0.5.14")
        source = source / "backend"
    if not regular(venv / "bin" / command) or regular(site / f"levelup-{name}.pth") != f"{source}\n".encode():
        raise ValueError(f"Instalação Python divergente: {venv}")
    for pkg in packages:
        if not regular(site / (pkg + ".dist-info") / "METADATA"):
            raise ValueError(f"Metadados ausentes: {pkg}")


def check_existing(item, base):
    name = item["localPath"]
    if name == "developer-roadmap":
        if regular(base / "referencia.url") != shortcut(item):
            raise ValueError("referencia.url já existe com outro conteúdo.")
        return
    files = check_sources(item, base / "source")
    if name in ("deeptutor", "voicestudio"):
        check_python(base, name)
    elif name == "mattpocock-skills":
        root = base / "instalado/.agents/skills"
        for relative, data in files.items():
            if relative.startswith("skills/productivity/"):
                target = root / relative.removeprefix("skills/productivity/")
                if regular(target) != data:
                    raise ValueError(f"Habilidade instalada divergente: {target}")
        for skill in ("teach", "grill-me", "grilling"):
            if regular(root / skill / "LICENSE") != files["LICENSE"]:
                raise ValueError(f"Licença divergente: {skill}")
    elif name == "freecodecamp":
        bundle = regular(base / "instalado/provas.cjs")
        # O esbuild anota o caminho local das duas fontes nos comentários do bundle.
        bundle = re.sub(rb"^// (?:[^\n]*/)?(api/src/utils/exam\.ts|packages/shared/src/utils/shuffle-array\.ts)$",
                        rb"// \1", bundle, flags=re.M)
        expected = "d42e40c68f9e60d116199c3c71977b66be23e95179f16f1187aa048a6878bc64"
        if hashlib.sha256(bundle).hexdigest() != expected or regular(base / "instalado/LICENSE.md") != files["LICENSE.md"]:
            raise ValueError(f"Bundle ou licença divergente: {base}")


@contextmanager
def locked_dest(dest):
    guarded(dest).mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(dest, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        os.close(descriptor)


def install(item, dest):
    name = item["localPath"]
    if not re.fullmatch(r"[a-z][a-z0-9-]+", name):
        raise ValueError(f"Nome de pasta inválido: {name}")
    with locked_dest(dest):
        base = guarded(dest / name)
        try:
            base.mkdir(mode=0o700)
        except FileExistsError:
            try:
                check_existing(item, base)
            except (OSError, ValueError, subprocess.CalledProcessError) as error:
                raise ValueError(f"Pasta ocupada preservada: {base}. {error}") from error
            print("Instalação existente conferida em modo de leitura.")
            return
        try:
            install_new(item, base)
            check_existing(item, base)
        except BaseException:
            # Preserva os arquivos de uma tentativa interrompida e libera o nome para a repetição.
            failed = Path(tempfile.mkdtemp(prefix=f".{name}-incompleto-", dir=dest))
            base.rename(failed / "instalacao")
            print(f"Tentativa incompleta preservada em {failed}", file=sys.stderr)
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, required=True, help="diretório externo dedicado às referências")
    parser.add_argument("--repo", help="um dono/nome do manifesto, opcional")
    args = parser.parse_args()
    target = Path(os.path.abspath(args.dest))
    if target.is_relative_to(PROJECT) or target in PROJECT.parents:
        parser.error("Escolha um destino fora do checkout do LevelUp.")
    items = json.loads(MANIFEST.read_text(encoding="utf-8"))
    selected = [item for item in items if args.repo is None or item["repo"].casefold() == args.repo.casefold()]
    if not selected:
        parser.error("Repositório ausente do manifesto.")
    for item in selected:
        print(f"\n{item['repo']} @ {item['sha']}", flush=True)
        try:
            install(item, target)
        except (OSError, ValueError, subprocess.CalledProcessError) as error:
            parser.exit(1, f"{error}\n")
