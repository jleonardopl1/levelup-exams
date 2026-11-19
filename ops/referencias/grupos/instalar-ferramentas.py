#!/usr/bin/env python3
"""Instala referências em diretórios individuais fora do checkout.

Ambiente verificado: Linux x64 (glibc), Python 3.11+, Node 24.22.1 e npm 11.
Use --dest ../levelup-referencias. Acrescente --only para uma ferramenta ou
--verify-only para conferir os arquivos e executar os testes sem reinstalar.
O prefixo do n8n ocupou 2,4 GB. O npm também usa espaço temporário na instalação.
O manifesto fixa as versões e a integridade dos pacotes principais. O npm gera
o lockfile de dependências transitivas no diretório da instalação.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GROUP = Path(__file__).with_name("ferramentas.json")
CHECKOUT = Path(__file__).resolve().parents[3]
PACKAGES = {
    "hyperframes": ("hyperframes", "0.9.65", "sha512-Rr/bhaA9e4ytXQRRsboG1m6kgOIzaE22FIFoHJsag2uls0mWbQW6MK/Vxm7plVBEn35p7piCv1SN7jCrfxdgNQ=="),
    "ag-ui": ("@ag-ui/core", "1.0.5", "sha512-W7xg7E/bVco3svYxZCp3CMqJ6/fB15U7yAaMS3mhLCwwlJXFzZJ/bGwMqnNrx6Afmj1WmnjFKzliYds+KFXMMQ=="),
    "impeccable": ("impeccable", "4.9.2", "sha512-4gO8ni/yZVpNW+3yP019VS+5C8f8J8rClnBdmPv0aod/oadYQW4A07T1aV5T3OAKH57xUfiKD2PwEVdAewyeig=="),
    "n8n": ("n8n-workflow", "2.49.0", "sha512-NS909F/M1pxtuXUtKCM5OLjPUaT5xwwvFEZOZaD6NVXg0syWO4D69OT+qKgYQn4z03Cre3gJ0aYmiYXpGkCx0Q=="),
}
CLIS = {
    "openclaw": ("openclaw", "2026.11.5", "sha512-mqPlsGLOe8NS85BfP1vWW9YVwFXchsV75QTkEbyR4csylORxts+fmfZp9+qbD7aPbXQIctyjRk+CPL91fDvxBA=="),
    "n8n": ("n8n", "2.49.0", "sha512-v2WaozoGZgqcJSB5WvTxurSJ7RDQJW1g9rOxWFKVT3kuXXxeTKboAus87RHhPCrJA31ySQ3aVo1bCF+XvsC3ew=="),
}
NATIVE = {
    "@openclaw/fs-safe-linux-x64-gnu": ("0.26.13", "sha512-nzZMTHFPaHXHQH9HXX5YoN/OEivPpmBlcWrSErK8O3iB0E05uiOG8IYIHgsZZUzLwsVdYbvrIYc6uVwxRR/Qfw=="),
    "@openclaw/proc-safe-linux-x64-gnu": ("0.4.2", "sha512-bQc6mqlccikVH1DIZ/iDJUW9hCkONmy5k6KvOKz2bxwUj928Rq1AtkNIqDLMitas7Nc7cJuFxYjHur2OL4uLjA=="),
}
SKILLS = {
    "humanizer": {"humanizer": ("", ["SKILL.md"])},
    "hallmark": {"hallmark": ("skills/hallmark", [
        "SKILL.md", "LICENSE", "references/gates.md", "references/craft.md",
        "references/responsive.md", "references/interaction-and-states.md",
        "references/flow.md", "scripts/sloplint.mjs", "scripts/sloplint-render.mjs",
    ])},
    "scroll-craft": {"scroll-craft": ("plugins/nateherk-design/skills/scroll-craft", [
        "SKILL.md", "engine/scrollcraft.js", "engine/scrollcraft.css", "references/feel.md",
        "references/taste.md", "references/verify.md", "references/template.html",
        "references/uniqueness.md", "references/approved-collection.md", "references/assets.md",
        "references/devices.md", "references/device-diag.html", "references/hero-depth.md",
        "references/worldflight.md", "references/worlds.md", "templates/FINGERPRINTS.md",
    ])},
    "knowledge-work-plugins": {
        "ticket-triage": ("customer-support/skills/ticket-triage", ["SKILL.md"]),
        "draft-response": ("customer-support/skills/draft-response", ["SKILL.md"]),
        "validate-data": ("data/skills/validate-data", ["SKILL.md"]),
    },
}
MODULES = {
    "openclaw": "packages/retry/src/index.ts",
    "deepseek-harness": "packages/util/timeout/src/index.ts",
}
STATIC_HTML = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Simulado</title></head><body><main><h1>Revisão da trilha</h1><p>Faça o simulado.</p></main></body></html>"""
COMPOSITION_HTML = """<!doctype html><html lang="pt-BR"><head><title>Simulado</title></head>
<body><main data-composition-id="levelup" data-width="1080" data-height="1920" data-duration="3">
<h1>Simulado</h1></main><script>window.__timelines = window.__timelines || {};
window.__timelines["levelup"] = { duration: () => 3 };</script></body></html>"""
NODE_CHECKS = {
    "ag-ui": """
        import {EventType, PROTOCOL_VERSION} from '@ag-ui/core';
        assert.ok(PROTOCOL_VERSION);
        for (const kind of ['RUN_STARTED', 'TEXT_MESSAGE_CONTENT', 'RUN_FINISHED']) {
            assert.equal(EventType[kind], kind);
        }
    """,
    "openclaw": """
        import {computeBackoffSchedule, racePromiseWithAbortSignal} from './src/index.ts';
        assert.equal(computeBackoffSchedule([5, 10], 1), 5);
        assert.equal(computeBackoffSchedule([5, 10], 3), 10);
        await assert.rejects(racePromiseWithAbortSignal(() => Promise.resolve(1), AbortSignal.abort()), {name:'AbortError'});
    """,
    "deepseek-harness": """
        import {deadline, clampTimeout} from './src/index.ts';
        assert.equal(clampTimeout(99, 10, 30), 30);
        const d = deadline(undefined, 10, 'MENTOR');
        await new Promise(resolve => setTimeout(resolve, 35));
        assert.equal(d.signal.aborted, true);
        assert.equal(d.signal.reason.code, 'MENTOR');
        d[Symbol.dispose]();
    """,
    "n8n": """
        import {createRequire} from 'node:module';
        const require = createRequire(import.meta.url);
        const {safeParseWorkflowStructure} = require('n8n-workflow');
        assert.equal(safeParseWorkflowStructure({nodes:[], connections:{}}).success, true);
        assert.equal(safeParseWorkflowStructure({nodes:42, connections:{}}).success, false);
    """,
}


def check(passed, detail):
    if not passed:
        raise ValueError(detail)


def output(cwd, args, accepted=(0,)):
    inherited = os.environ if args[0] == "npm" else {
        k: os.environ[k] for k in ("PATH", "LANG", "TZ", "TMPDIR", "SYSTEMROOT") if k in os.environ
    }
    env = dict(inherited, HYPERFRAMES_NO_TELEMETRY="1", DO_NOT_TRACK="1",
               HYPERFRAMES_NO_UPDATE_CHECK="1", NO_UPDATE_NOTIFIER="1",
               OPENCLAW_NO_RESPAWN="1", OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL="1",
               N8N_DIAGNOSTICS_ENABLED="false", N8N_VERSION_NOTIFICATIONS_ENABLED="false")
    process = subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True)
    if process.returncode not in accepted:
        raise RuntimeError(f"{args[0]} {args[1]} terminou com {process.returncode}: {process.stderr[-650:] or process.stdout[-650:]}")
    return process.stdout


def guard_path(path):
    for part in (path, *path.parents):
        check(not part.is_symlink(), f"Link simbólico em caminho reservado: {part}")


def save(path, body):
    guard_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        check(path.read_bytes() == body, f"Arquivo local divergente: {path}")
    else:
        with path.open("xb") as handle:
            handle.write(body)


def source_mapping(entry):
    slug = entry["localPath"]
    mapping = []
    if slug in MODULES:
        mapping.append((MODULES[slug], "src/index.ts"))
    for profile, (prefix, paths) in SKILLS.get(slug, {}).items():
        for path in paths:
            mapping.append((str(PurePosixPath(prefix) / path), f".agents/skills/{profile}/{path}"))
    if mapping:
        mapping.append(("LICENSE", "LICENSE.upstream"))
    return mapping


def source_file(entry, dest, pair):
    remote, local = pair
    url = f"https://raw.githubusercontent.com/{entry['repo']}/{entry['sha']}/{remote}"
    request = Request(url, headers={"User-Agent": "LevelUp-Exams-referencias"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                body = response.read()
            check(hashlib.sha256(body).hexdigest() == entry["fileHashes"][local], f"SHA-256 da origem diverge: {remote}")
            save(dest / local, body)
            return
        except HTTPError as err:
            if err.code < 500:
                raise
            if attempt == 2:
                raise
        except URLError:
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


def npm_package(slug, dest, verify_only, cli=False):
    name, version, integrity = (CLIS if cli else PACKAGES)[slug]
    expected = {name: version}
    integrities = {name: integrity}
    if not cli and slug in ("ag-ui", "n8n"):
        expected["zod"] = "3.25.76"
    if cli and slug == "openclaw" and platform.system() == "Linux" and platform.machine() == "x86_64" and platform.libc_ver()[0] == "glibc":
        for dep, (release, checksum) in NATIVE.items():
            expected[dep] = release
            integrities[dep] = checksum
    package, lock, modules = (dest / p for p in ("package.json", "package-lock.json", "node_modules"))
    for p in (dest, package, lock, modules):
        guard_path(p)
    if not verify_only and not lock.exists():
        check(not modules.exists(), f"node_modules preexistente sem lock: {dest}")
        if cli and dest.exists():
            check(not any(dest.iterdir()), f"Prefixo de CLI ocupado: {dest}")
        if not package.exists():
            save(package, json.dumps({"private": True, "name": f"levelup-ref-{slug}"}).encode())
        metadata = json.loads(package.read_text())
        check(metadata == {"private": True, "name": f"levelup-ref-{slug}"}, f"package.json preexistente: {package}")
        args = ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"]
        if cli:
            args += ["--omit=optional", "--legacy-peer-deps"]
        with tempfile.TemporaryDirectory(prefix="levelup-ref-npm-") as cache:
            args += ["--cache", cache]
            output(dest, [*args, *(f"{dep}@{release}" for dep, release in expected.items())])
    declared = json.loads(package.read_text()).get("dependencies")
    check(declared == expected, f"Dependências divergentes no manifesto de {name}")
    lockfile = json.loads(lock.read_text())["packages"]
    for dep, release in expected.items():
        installed = modules / dep / "package.json"
        guard_path(installed)
        check(json.loads(installed.read_text())["version"] == release, f"Versão de {dep}")
        recorded = lockfile.get(f"node_modules/{dep}", {})
        check(recorded.get("version") == release, f"Lock de {dep}")
        if dep in integrities:
            check(recorded.get("integrity") == integrities[dep], f"Integridade npm de {dep}")


def executable(dest, name):
    binary = dest / "node_modules/.bin" / name
    guard_path(binary.parent)
    check(binary.resolve().is_relative_to(dest / "node_modules" / name), f"Executável fora do pacote: {binary}")
    return str(binary)


def discover(dest, profile):
    src = (dest / ".agents" / "skills" / profile / "SKILL.md").read_text()
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n(.+)", src, re.S)
    check(match is not None, f"Frontmatter ausente em {profile}")
    metadata, content = match.groups()
    check(re.search(rf"^name:\s*{re.escape(profile)}\s*$", metadata, re.M), f"Nome incorreto: {profile}")
    check(re.search(r"^description:\s*\S", metadata, re.M) and len(content.strip()) > 120, f"Perfil incompleto: {profile}")


def verify(entry, dest):
    slug = entry["localPath"]
    results = []
    for profile in SKILLS.get(slug, {}):
        discover(dest, profile)
        results.append(f"perfil {profile}")
    if slug in NODE_CHECKS:
        args = ["node", "--disable-warning=ExperimentalWarning", "--experimental-transform-types", "--input-type=module", "-e"]
        output(dest, [*args, "import assert from 'node:assert/strict';" + NODE_CHECKS[slug]])
        results.append("asserções do módulo")
    if slug in CLIS:
        cli = executable(dest / "cli", slug)
        version = output(dest, [cli, "--version"])
        check(CLIS[slug][1] in version, f"Versão inesperada de {slug}: {version}")
        results.append(f"CLI {version.strip()}")
    if slug == "scroll-craft":
        engine = dest / ".agents/skills/scroll-craft/engine"
        output(dest, ["node", "--check", str(engine / "scrollcraft.js")])
        check((engine / "scrollcraft.css").stat().st_size > 0, "Folha de estilo vazia")
        results.append("motor JavaScript e CSS")
    if slug in ("hyperframes", "impeccable", "hallmark"):
        with tempfile.TemporaryDirectory() as fixture:
            page = Path(fixture) / "pagina.html"
            page.write_text(STATIC_HTML)
            if slug == "hallmark":
                cli = dest / ".agents/skills/hallmark/scripts/sloplint.mjs"
                data = json.loads(output(dest, ["node", str(cli), "--json", str(page)], (0, 1, 2)))
                check(isinstance(data, (dict, list)), "Saída do sloplint")
                results.append("sloplint estático em HTML")
            else:
                cli = executable(dest, slug)
                v = output(dest, [cli, "--version"])
                check(PACKAGES[slug][1] in v, f"Versão inesperada: {v}")
                if slug == "hyperframes":
                    data = json.loads(output(dest, [cli, "lint", "--json", str(page)], (1,)))
                    check(data["filesScanned"] == 1 and "root_missing_composition_id" in [f["code"] for f in data["findings"]], "Composição malformada deveria ser detectada")
                    page.write_text(COMPOSITION_HTML)
                    data = json.loads(output(dest, [cli, "lint", "--json", str(page)]))
                    check(data["ok"] and data["filesScanned"] == 1 and data["errorCount"] == 0, "Composição válida recusada")
                else:
                    data = json.loads(output(dest, [cli, "detect", "--json", str(page)], (0, 2)))
                    check(isinstance(data, list), "Saída do detector")
                results.append("versão e diagnóstico de HTML")
    return results


def install(entry, base, verify_only):
    slug = entry["localPath"]
    dest = base / slug
    marker, receipt = (dest / n for n in (".levelup-install.json", ".levelup-verification.json"))
    identity = {"repo": entry["repo"], "sha": entry["sha"]}
    for path in (dest, marker, receipt):
        guard_path(path)
    if dest.exists() and any(dest.iterdir()):
        check(marker.is_file() or receipt.is_file(), f"Diretório ocupado sem registro LevelUp: {dest}")
    for record in (marker, receipt):
        if record.exists():
            value = json.loads(record.read_text())
            check(isinstance(value, dict) and all(value.get(k) == v for k, v in identity.items()),
                  f"Registro de outra instalação: {record}")
    if verify_only:
        check(dest.is_dir(), f"Instalação ausente: {dest}")
    elif not marker.exists():
        save(marker, json.dumps(identity, sort_keys=True).encode())
    hashes = entry["fileHashes"]
    for local, digest in hashes.items():
        path = dest / local
        guard_path(path)
        if path.exists() or verify_only:
            check(hashlib.sha256(path.read_bytes()).hexdigest() == digest, f"SHA-256 divergente: {local}")
    if slug in PACKAGES:
        npm_package(slug, dest, verify_only)
    if slug in CLIS:
        npm_package(slug, dest / "cli", verify_only, cli=True)
    pairs = [(remote, local) for remote, local in source_mapping(entry) if not (dest / local).exists()]
    if pairs and not verify_only:
        with ThreadPoolExecutor(max_workers=6) as worker:
            list(worker.map(lambda pair: source_file(entry, dest, pair), pairs))
    for local, digest in hashes.items():
        path = dest / local
        guard_path(path)
        check(hashlib.sha256(path.read_bytes()).hexdigest() == digest, f"SHA-256 divergente: {local}")
    tests = verify(entry, dest)
    check(tests, f"Nenhum teste para {slug}")
    if not verify_only:
        body = json.dumps({**identity, "verificacoes": tests}, ensure_ascii=False, indent=2) + "\n"
        if not receipt.exists() or receipt.read_text() != body:
            with tempfile.NamedTemporaryFile(mode="w", dir=dest, delete=False) as new_record:
                new_record.write(body)
            Path(new_record.name).replace(receipt)
    return ", ".join(tests)


def main():
    entries = json.loads(GROUP.read_text())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, required=True)
    parser.add_argument("--only", choices=[x["localPath"] for x in entries])
    parser.add_argument("--verify-only", action="store_true", help="Testa as instalações locais sem fazer downloads")
    args = parser.parse_args()
    try:
        guard_path(args.dest.absolute())
        base = args.dest.resolve()
        check(base != CHECKOUT and base not in CHECKOUT.parents and CHECKOUT not in base.parents,
              "O destino deve ficar fora do checkout e não pode conter o checkout.")
    except ValueError as err:
        parser.error(str(err))
    selected = [x for x in entries if args.only is None or args.only == x["localPath"]]
    failures = 0
    with ThreadPoolExecutor(max_workers=3) as worker:
        jobs = [(entry, worker.submit(install, entry, base, args.verify_only)) for entry in selected]
        for entry, future in jobs:
            try:
                result = future.result()
                print(f"{entry['localPath']}: OK ({result})", flush=True)
            except (OSError, ValueError, RuntimeError) as err:
                failures += 1
                print(f"{entry['localPath']}: {err}", file=sys.stderr, flush=True)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
