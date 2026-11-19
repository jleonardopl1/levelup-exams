"""Regressões locais do instalador de produto. Requer Python e Git."""

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import instalar_produto as produto


class DestinosDoProduto(unittest.TestCase):
    def setUp(self):
        pasta = tempfile.TemporaryDirectory()
        self.addCleanup(pasta.cleanup)
        self.root = Path(pasta.name)
        self.lab = self.root / "laboratorio"
        self.roadmap = next(item for item in json.loads(produto.MANIFEST.read_text())
                            if item["localPath"] == "developer-roadmap")

    def instalar(self, item):
        with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
            produto.install(item, self.lab)

    def test_atalho_valido_pode_ser_reusado_e_atalho_pessoal_e_preservado(self):
        self.instalar(self.roadmap)
        atalho = self.lab / "developer-roadmap/referencia.url"
        anterior = atalho.stat().st_mtime_ns
        self.instalar(self.roadmap)
        self.assertEqual(atalho.stat().st_mtime_ns, anterior)
        atalho.write_text("atalho pessoal")
        with self.assertRaisesRegex(ValueError, "Pasta ocupada preservada"):
            self.instalar(self.roadmap)
        self.assertEqual(atalho.read_text(), "atalho pessoal")

    def test_recusa_links_no_destino_na_pasta_do_item_e_no_atalho(self):
        fora = self.root / "externo"
        fora.mkdir()
        outro = fora / "arquivo"
        outro.write_text("original")
        self.lab.symlink_to(fora, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Link simbólico"):
            self.instalar(self.roadmap)
        self.lab.unlink()
        self.lab.mkdir()
        item = self.lab / "developer-roadmap"
        item.symlink_to(fora, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Link simbólico"):
            self.instalar(self.roadmap)
        item.unlink()
        item.mkdir()
        (item / "referencia.url").symlink_to(outro)
        with self.assertRaisesRegex(ValueError, "Link simbólico"):
            self.instalar(self.roadmap)
        self.assertEqual(outro.read_text(), "original")
        self.assertEqual(list(fora.iterdir()), [outro])

    def test_skill_local_alterada_ou_com_link_e_preservada(self):
        base = self.lab / "mattpocock-skills"
        source = base / "source"
        source.mkdir(parents=True)
        def git(*args):
            return subprocess.check_output(["git", "-C", source, *args], text=True).strip()
        git("init", "-q", "-b", "pin")
        git("remote", "add", "origin", "https://github.com/mattpocock/skills.git")
        (source / "README.md").write_text("Catálogo de teste")
        (source / "LICENSE").write_text("Teste")
        for name in ("teach", "grill-me", "grilling"):
            skill = source / "skills/productivity" / name
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(f"---\nname: {name}\n---\nPerfil de teste\n")
        git("add", ".")
        git("-c", "user.name=Teste", "-c", "user.email=teste@example.invalid",
            "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", "commit", "-q", "-m", "Amostra")
        item = {"localPath": base.name, "repo": "mattpocock/skills", "sha": git("rev-parse", "HEAD"),
                "sourcePaths": ["README.md", "LICENSE", "skills/productivity/teach/SKILL.md"]}
        with redirect_stdout(StringIO()):
            produto.skills(base, source)
        self.instalar(item)
        target = base / "instalado/.agents/skills/teach/SKILL.md"
        target.write_text("rascunho pessoal")
        with self.assertRaisesRegex(ValueError, "Habilidade instalada divergente"):
            self.instalar(item)
        self.assertEqual(target.read_text(), "rascunho pessoal")
        externo = self.root / "arquivo-pessoal"
        target.rename(externo)
        target.symlink_to(externo)
        with self.assertRaisesRegex(ValueError, "Link simbólico"):
            self.instalar(item)
        self.assertEqual(externo.read_text(), "rascunho pessoal")

    def test_falha_em_pasta_nova_preserva_tentativa_e_libera_repeticao(self):
        def falha(_, base):
            (base / "parcial").write_text("conteúdo preservado")
            raise OSError("interrupção simulada")
        with patch.object(produto, "install_new", side_effect=falha), self.assertRaises(OSError):
            self.instalar(self.roadmap)
        self.assertFalse((self.lab / "developer-roadmap").exists())
        parciais = list(self.lab.glob(".developer-roadmap-incompleto-*/instalacao/parcial"))
        self.assertEqual(len(parciais), 1)
        self.assertEqual(parciais[0].read_text(), "conteúdo preservado")
        self.instalar(self.roadmap)
        self.assertEqual((self.lab / "developer-roadmap/referencia.url").read_bytes(), produto.shortcut(self.roadmap))


if __name__ == "__main__":
    unittest.main()
