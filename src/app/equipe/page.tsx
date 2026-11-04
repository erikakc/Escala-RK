"use client";

import { useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = funcionário novo
  nome: string;
  funcao: string;
  telefone: string;
};

const formularioVazio: Formulario = {
  id: null,
  nome: "",
  funcao: FUNCOES_PADRAO[0],
  telefone: "",
};

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ao mudar "versao", a lista é recarregada do banco.
  const [versao, setVersao] = useState(0);
  const carregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    async function buscar() {
      if (!variaveisConfiguradas()) {
        setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
        setCarregando(false);
        return;
      }
      const { data, error } = await supabase()
        .from("funcionarios")
        .select("id, nome, funcao, telefone, cpf, ativo")
        .order("nome");
      if (error) setErro(`Não foi possível carregar a equipe. Detalhe: ${error.message}`);
      else setFuncionarios(data ?? []);
      setCarregando(false);
    }
    buscar();
  }, [versao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    if (!nome) {
      setErro("Preencha o nome do funcionário.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const dados = {
      nome,
      funcao: formulario.funcao,
      telefone: formulario.telefone.trim() || null,
    };
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar. Detalhe: ${error.message}`);
      return;
    }
    setFormulario(null);
    carregar();
  }

  async function mudarAtivo(funcionario: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${funcionario.nome}? Ele(a) deixa de aparecer na escala.`)) {
      return;
    }
    setErro(null);
    const { error } = await supabase()
      .from("funcionarios")
      .update({ ativo })
      .eq("id", funcionario.id);
    if (error) setErro(`Não foi possível atualizar. Detalhe: ${error.message}`);
    else carregar();
  }

  // Inclui a função atual na lista, caso ela não esteja entre as padrão.
  const opcoesFuncao =
    formulario && !FUNCOES_PADRAO.includes(formulario.funcao)
      ? [...FUNCOES_PADRAO, formulario.funcao]
      : FUNCOES_PADRAO;

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao" onClick={() => setFormulario(formularioVazio)}>
            + Adicionar funcionário
          </button>
        )}
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      {formulario && (
        <form onSubmit={salvar} className="cartao space-y-4">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
            >
              {opcoesFuncao.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="botao flex-1" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              className="botao-secundario flex-1"
              type="button"
              onClick={() => setFormulario(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-neutral-600">Carregando...</p>
      ) : (
        <>
          <section className="space-y-3">
            {ativos.length === 0 && <p className="text-neutral-600">Nenhum funcionário ativo.</p>}
            {ativos.map((f) => (
              <div key={f.id} className="cartao space-y-3">
                <div>
                  <p className="text-lg font-semibold">{f.nome}</p>
                  <p className="text-neutral-700">{f.funcao}</p>
                  {f.telefone && (
                    <a className="text-neutral-700 underline" href={`tel:${f.telefone}`}>
                      {f.telefone}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="botao-secundario flex-1"
                    onClick={() =>
                      setFormulario({
                        id: f.id,
                        nome: f.nome,
                        funcao: f.funcao,
                        telefone: f.telefone ?? "",
                      })
                    }
                  >
                    Editar
                  </button>
                  <button className="botao-secundario flex-1" onClick={() => mudarAtivo(f, false)}>
                    Desativar
                  </button>
                </div>
              </div>
            ))}
          </section>

          {inativos.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-neutral-600">Desativados</h2>
              {inativos.map((f) => (
                <div
                  key={f.id}
                  className="cartao flex items-center justify-between gap-3 opacity-70"
                >
                  <div>
                    <p className="font-semibold">{f.nome}</p>
                    <p className="text-sm text-neutral-700">{f.funcao}</p>
                  </div>
                  <button className="botao-secundario" onClick={() => mudarAtivo(f, true)}>
                    Reativar
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
