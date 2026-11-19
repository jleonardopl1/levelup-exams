#!/usr/bin/env python3
"""Instala perfis isolados e verifica as escolhas em governanca.json (Python 3.10+)."""
import argparse
import functools
import gzip
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

MANIFEST = Path(__file__).with_name("governanca.json")
PROJECT = MANIFEST.resolve().parents[3]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked_path(parent, path):
    relative = Path(path)
    require(relative.parts and not relative.is_absolute() and ".." not in relative.parts,
            f"Caminho externo: {path}")
    result = parent
    for part in relative.parts:
        result = result / part
        require(not result.is_symlink(), f"Link simbólico em caminho de instalação: {result}")
    require(result.resolve().is_relative_to(parent) and result != parent, f"Caminho externo: {path}")
    return result


def download(url, destination, expected):
    request = Request(url, headers={"User-Agent": "LevelUp-Exams-referencias/1"})
    with urlopen(request, timeout=90) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)
    require(sha256(destination) == expected, f"SHA-256 divergente: {url}")


def already_installed(path, expected):
    require(not path.is_symlink(), f"Link inesperado: {path}")
    if not path.exists():
        return False
    require(path.is_file() and sha256(path) == expected, f"Colisão com arquivo existente: {path}")
    return True


def publish(new, target, expected):
    try:
        os.link(new, target)
    except FileExistsError:
        require(already_installed(target, expected), f"Arquivo mudou durante a instalação: {target}")


def install_file(url, expected, target, verify_only):
    if already_installed(target, expected):
        return
    require(not verify_only, f"Arquivo ausente ou alterado: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as temp:
        new = Path(temp) / "conteudo"
        download(url, new, expected)
        publish(new, target, expected)


def section_content(row, upstream):
    recipe = row["recipe"]
    heading = recipe["heading"]
    lines = upstream.splitlines()
    start = lines.index(heading)
    heading_level = len(heading.split()[0])
    end = next((n for n in range(start + 1, len(lines))
                if re.match(r"^#{1," + str(heading_level) + r"}\s", lines[n])), len(lines))
    url = f"https://github.com/{row['repo']}/blob/{row['sha']}/{recipe['source']}"
    attribution = (
        f"Recorte de [{row['repo']}]({url}), de seus autores e colaboradores. "
        f"Licença {row['license']}. Seleção de uma seção a partir da revisão {row['sha']}.\n\n"
    )
    return (attribution + "\n".join(lines[start:end]).strip() + "\n").encode()


def install_section(row, root, verify_only):
    recipe = row["recipe"]
    target = checked_path(root, "SECAO.md")
    expected = recipe["sectionSha256"]
    if not already_installed(target, expected):
        require(not verify_only, f"Seção ausente ou alterada: {target}")
        with tempfile.TemporaryDirectory(dir=root) as temp:
            source = Path(temp) / "original"
            url = f"https://raw.githubusercontent.com/{row['repo']}/{row['sha']}/{recipe['source']}"
            download(url, source, recipe["sourceSha256"][recipe["source"]])
            new = Path(temp) / "secao"
            new.write_bytes(section_content(row, source.read_text(encoding="utf-8")))
            require(sha256(new) == expected, f"Seleção de seção divergente: {row['repo']}")
            publish(new, target, expected)
    contents = target.read_text(encoding="utf-8")
    require(recipe["marker"] in contents and recipe["heading"] in contents.splitlines(), "Recorte incompleto")
    return target, f"{recipe['heading']} contém {recipe['marker']}"


def install_binary(row, root, verify_only):
    recipe = row["recipe"]
    require(platform.system() == "Linux" and platform.machine() in ("x86_64", "amd64"),
            "O binário fixado requer Linux x86-64.")
    target = checked_path(root, Path("bin") / row["localPath"])
    if already_installed(target, recipe["binarySha256"]):
        require(os.access(target, os.X_OK), f"Binário existente sem permissão de execução: {target}")
        return target
    require(not verify_only, f"Binário ausente ou alterado: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://github.com/{row['repo']}/releases/download/{recipe['tag']}/{recipe['asset']}"
    with tempfile.TemporaryDirectory(dir=target.parent) as temp:
        asset = Path(temp) / "asset"
        download(url, asset, recipe["downloadSha256"])
        new = asset
        if recipe["asset"].endswith(".gz"):
            new = Path(temp) / "programa"
            with gzip.open(asset, "rb") as source, new.open("wb") as dest:
                shutil.copyfileobj(source, dest)
        require(sha256(new) == recipe["binarySha256"], "SHA-256 do executável divergente")
        new.chmod(0o755)
        publish(new, target, recipe["binarySha256"])
    return target


def run(command, work, env):
    proc = subprocess.run([str(arg) for arg in command], cwd=work, env=env, capture_output=True,
                          text=True, timeout=45)
    require(proc.returncode == 0, proc.stderr.strip() or proc.stdout.strip() or f"Falha em {command[0]}")
    return proc.stdout.strip()


def test_guide(binary, work, env):
    name = "guia-de-exemplo"
    guide = {"title": name, "intent": "Revisar uma mudança de enunciado.",
             "sections": [{"title": "Enunciado", "overview": "Revisão do título.",
                           "diffs": [{"file": "aula.md", "summary": "Adiciona um enunciado."}]}]}
    (work / "guia.json").write_text(json.dumps(guide), encoding="utf-8")
    (work / "alteracao.patch").write_text(
        "diff --git a/aula.md b/aula.md\n--- a/aula.md\n+++ b/aula.md\n@@ -1 +1 @@\n-Antigo\n+Novo\n",
        encoding="utf-8")
    run([binary, "guide", "export", "--guide", "guia.json", "--patch", "alteracao.patch",
         "--viewer-url", "http://127.0.0.1/viewer/", "--out", "guia.html"], work, env)
    html = (work / "guia.html").read_text(encoding="utf-8")
    require("<html" in html.lower() and "127.0.0.1/viewer/" in html and name in html,
            "Exportação do guia de revisão inválida")
    return "Guia e diff sintéticos exportados em HTML com viewer local."


class FixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def test_browser(binary, work, env, chromium, container_fixture):
    public = work / "public"
    public.mkdir()
    label = "Iniciar simulado"
    (public / "index.html").write_text(
        '<!doctype html><html lang="pt-BR"><title>LevelUp</title><button>' + label + '</button></html>',
        encoding="utf-8")
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(FixtureHandler, directory=public))
    base = [binary, "--session", "levelup-fixture", "--allowed-domains", "127.0.0.1",
            "--executable-path", chromium]
    if container_fixture:
        # O contêiner isola este processo e esta fixture aceita apenas um endereço de loopback.
        base.extend(["--args", "--no-sandbox"])
    with server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            run(base + ["open", f"http://127.0.0.1:{server.server_port}"], work, env)
            snapshot = run(base + ["snapshot", "-i"], work, env)
            require(label in snapshot and "button" in snapshot, "Botão ausente na árvore acessível")
        finally:
            server.shutdown()
            run(base + ["close"], work, env)
    return f'Chromium local abriu a fixture em loopback e encontrou o botão "{label}" na árvore acessível.'


def smoke(row, root, binary, chromium, container_fixture=False):
    with tempfile.TemporaryDirectory(prefix="lvl-") as temp:
        work = Path(temp)
        env = {"PATH": os.defpath, "HOME": temp, "XDG_CONFIG_HOME": temp, "XDG_CACHE_HOME": temp,
               "PLANNOTATOR_SHARE": "disabled", "AGENT_BROWSER_NO_VERSION_CHECK": "1",
               "AGENT_BROWSER_SOCKET_DIR": temp, "NO_PROXY": "127.0.0.1,localhost", "LANG": "C.UTF-8"}
        if binary:
            version = run([binary, "--version"], work, env)
            require(version.split()[-1] == row["recipe"]["version"], f"Versão inesperada: {version}")
            if row["localPath"] == "plannotator":
                return [version, test_guide(binary, work, env)]
            if chromium:
                return [version, test_browser(binary, work, env, chromium, container_fixture)]
            return [version, "Teste de navegação opcional requer --chromium EXECUTAVEL."]
        tool = root / "scripts" / "schema_generate.py"
        name = "Docente de Exemplo"
        output = run([sys.executable, "-I", tool, "profile", "--name", name,
                      "--url", "https://exemplo.invalid/docente"], work, env)
        profile = json.loads(output)
        require(profile["@type"] == "ProfilePage" and profile["mainEntity"]["name"] == name,
                "Perfil JSON-LD incorreto")
        templates = json.loads((root / "schema" / "templates.json").read_text(encoding="utf-8"))
        require(bool(templates), "Coleção de templates vazia")
        return ["Gerador executado com perfil fictício; ProfilePage, mainEntity.name e coleção de templates validados."]


def check_receipt(path, identity):
    require(not path.is_symlink(), f"Link usado como recibo: {path}")
    if not path.exists():
        return False
    require(path.is_file(), f"Colisão no caminho do recibo: {path}")
    record = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(record, dict) and all(record.get(k) == v for k, v in identity.items())
            and isinstance(record.get("checks"), list) and all(isinstance(c, str) for c in record["checks"]),
            f"Recibo existente de outra instalação: {path}")
    return True


def install(row, destination, args):
    recipe = row["recipe"]
    root = checked_path(destination, row["localPath"])
    if not args.verify_only:
        root.mkdir(parents=True, exist_ok=True)
    require(root.is_dir(), f"Perfil ausente: {root}")
    sources = {}
    for name in recipe["files"] + recipe.get("skills", []):
        relative = Path(".claude") / name if name in recipe.get("skills", []) else Path(name)
        sources[str(relative)] = name
    expected = {relative: recipe["sourceSha256"][name] for relative, name in sources.items()}
    if recipe["type"] == "section":
        expected["SECAO.md"] = recipe["sectionSha256"]
    elif recipe["type"] == "release":
        expected["bin/" + row["localPath"]] = recipe["binarySha256"]
    identity = {"repo": row["repo"], "sha": row["sha"], "license": row["license"], "files": expected}
    receipt_path = checked_path(root, "recibo.json")
    received = check_receipt(receipt_path, identity)
    require(received or not args.verify_only, f"Recibo ausente: {receipt_path}")
    # Confere todas as colisões antes da primeira transferência, inclusive em uma repetição parcial.
    for relative, digest in expected.items():
        present = already_installed(checked_path(root, relative), digest)
        require(present or not args.verify_only, f"Arquivo ausente: {relative}")
    checks = []
    for rel, name in sources.items():
        relative = Path(rel)
        target = checked_path(root, relative)
        url = f"https://raw.githubusercontent.com/{row['repo']}/{row['sha']}/{name}"
        install_file(url, recipe["sourceSha256"][name], target, args.verify_only)
        if relative.name == "SKILL.md":
            source = target.read_text(encoding="utf-8")
            front = re.match(r"^---\s*\n(.+?)\n---", source, flags=re.S)
            require(front and re.search(r"^name:\s+" + re.escape(relative.parent.name) + r"\s*$",
                                        front[1], re.M) and re.search(r"^description:\s*\S", front[1], re.M),
                    f"Declaração de skill inválida: {relative}")
            checks.append(f"Perfil descobre {relative.parent.name} pelo nome e descrição.")
    if recipe["type"] == "section":
        _, check = install_section(row, root, args.verify_only)
        checks.append(check)
    elif recipe["type"] == "release":
        binary = install_binary(row, root, args.verify_only)
        checks += smoke(row, root, binary, args.chromium, args.chromium_container)
    elif recipe["type"] == "schema":
        checks += smoke(row, root, None, None)
    else:
        require(recipe["type"] == "skills", "Tipo de receita desconhecido")
    if not received:
        with tempfile.TemporaryDirectory(dir=root) as temp:
            draft = Path(temp) / "recibo.json"
            draft.write_text(json.dumps({**identity, "checks": checks}, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
            try:
                os.link(draft, receipt_path)
            except FileExistsError:
                require(check_receipt(receipt_path, identity), f"Recibo mudou durante instalação: {receipt_path}")
    print(f"{row['repo']} | {len(expected)} arquivos | {' '.join(checks)}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", required=True, type=Path, help="Diretório de perfis externo ao checkout")
    parser.add_argument("--only", action="append", help="Filtra um repositório com receita; pode repetir")
    parser.add_argument("--chromium", type=Path, help="Executável Chromium para testar a página sintética")
    parser.add_argument("--chromium-container", action="store_true",
                        help="Usa o isolamento do contêiner para a fixture local, se Chromium não tiver sandbox")
    parser.add_argument("--verify-only", action="store_true", help="Confere e testa sem baixar arquivos")
    args = parser.parse_args()
    if args.chromium_container and not args.chromium:
        parser.error("--chromium-container requer --chromium EXECUTAVEL.")
    root = args.dest.expanduser().resolve()
    require(not root.is_relative_to(PROJECT) and not PROJECT.is_relative_to(root),
            "Escolha um diretório de perfis separado do checkout.")
    if args.chromium:
        args.chromium = args.chromium.expanduser().resolve(strict=True)
    rows = [r for r in json.loads(MANIFEST.read_text(encoding="utf-8")) if r.get("recipe")]
    if args.only:
        available = {r["repo"] for r in rows}
        require(set(args.only) <= available, "A seleção contém repositório sem receita.")
        rows = [r for r in rows if r["repo"] in args.only]
    failures = []
    for row in rows:
        try:
            install(row, root, args)
        except (ValueError, OSError, subprocess.SubprocessError) as exc:
            failures.append(row["repo"])
            print(f"{row['repo']} | {exc}", file=sys.stderr, flush=True)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
