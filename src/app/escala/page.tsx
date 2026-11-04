"use client";

import { useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  rotuloDia,
  somarDias,
} from "@/lib/datas";

type CelulaAberta = { data: string; turno: Turno };

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [celula, setCelula] = useState<CelulaAberta | null>(null);
  const [gravando, setGravando] = useState<string | null>(null); // id do funcionário

  const dias = diasDaSemana(segunda);
  const domingo = dias[6];
  const hoje = hojeISO();

  // Turnos e funcionários: carregados uma vez.
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) {
        setErro("As variáveis do Supabase não foram configuradas. Veja a tela Início.");
        setCarregando(false);
        return;
      }
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro(`Não foi possível carregar os dados. Detalhe: ${(t.error ?? f.error)?.message}`);
        return;
      }
      setTurnos(t.data ?? []);
      setFuncionarios(f.data ?? []);
    }
    carregarBase();
  }, []);

  // Escala da semana: recarrega ao trocar de semana.
  useEffect(() => {
    async function buscar() {
      if (!variaveisConfiguradas()) return;
      const { data, error } = await supabase()
        .from("escalas")
        .select("id, data, turno_id, funcionario_id")
        .gte("data", segunda)
        .lte("data", domingo);
      if (error) setErro(`Não foi possível carregar a escala. Detalhe: ${error.message}`);
      else setEscalas(data ?? []);
      setCarregando(false);
    }
    buscar();
  }, [segunda, domingo]);

  function irParaSemana(novaSegunda: string) {
    setCarregando(true);
    setSegunda(novaSegunda);
  }

  const nomePorId = new Map(funcionarios.map((f) => [f.id, f]));

  function escaladosNa(data: string, turnoId: string): Escala[] {
    return escalas
      .filter((e) => e.data === data && e.turno_id === turnoId)
      .sort((a, b) =>
        (nomePorId.get(a.funcionario_id)?.nome ?? "").localeCompare(
          nomePorId.get(b.funcionario_id)?.nome ?? "",
        ),
      );
  }

  async function alternar(funcionario: Funcionario) {
    if (!celula) return;
    setErro(null);
    setGravando(funcionario.id);
    const existente = escalas.find(
      (e) =>
        e.data === celula.data &&
        e.turno_id === celula.turno.id &&
        e.funcionario_id === funcionario.id,
    );
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro(`Não foi possível tirar da escala. Detalhe: ${error.message}`);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data, error } = await db
        .insert({ data: celula.data, turno_id: celula.turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro(`Não foi possível colocar na escala. Detalhe: ${error.message}`);
      else if (data) setEscalas((atual) => [...atual, data]);
    }
    setGravando(null);
  }

  // Na lista da célula: os ativos, mais algum desativado que ainda esteja escalado ali.
  const opcoesCelula = celula
    ? funcionarios.filter(
        (f) =>
          f.ativo ||
          escalas.some(
            (e) =>
              e.data === celula.data && e.turno_id === celula.turno.id && e.funcionario_id === f.id,
          ),
      )
    : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="flex items-center justify-between gap-2">
        <button
          className="botao-secundario"
          onClick={() => irParaSemana(somarDias(segunda, -7))}
          aria-label="Semana anterior"
        >
          ◀ Anterior
        </button>
        <div className="text-center">
          <p className="font-semibold">
            {diaMes(segunda)} a {diaMes(domingo)}
          </p>
          {segunda !== inicioDaSemana(hoje) && (
            <button
              className="text-sm underline"
              onClick={() => irParaSemana(inicioDaSemana(hoje))}
            >
              Ir para esta semana
            </button>
          )}
        </div>
        <button
          className="botao-secundario"
          onClick={() => irParaSemana(somarDias(segunda, 7))}
          aria-label="Próxima semana"
        >
          Próxima ▶
        </button>
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      <p className="text-sm text-neutral-600">
        Toque em uma célula para escolher quem trabalha. Arraste a grade para o lado para ver todos
        os dias.
      </p>

      <div className="cartao overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm [&_td]:border-neutral-200 [&_th]:border-neutral-200">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] border-b border-r bg-white p-2 text-left">
                Turno
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className={`min-w-[7rem] border-b p-2 text-center ${
                    d === hoje ? "bg-yellow-50" : ""
                  }`}
                >
                  {rotuloDia(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <th className="sticky left-0 z-[1] border-r border-b bg-white p-2 text-left align-top">
                  <span className="block font-semibold">{t.nome}</span>
                  <span className="block text-xs font-normal text-neutral-600">
                    {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                  </span>
                </th>
                {dias.map((d) => {
                  const escalados = escaladosNa(d, t.id);
                  return (
                    <td
                      key={d}
                      className={`border-b p-1 align-top ${d === hoje ? "bg-yellow-50" : ""}`}
                    >
                      <button
                        className="min-h-24 w-full rounded-lg border border-dashed border-neutral-300 p-2 text-left active:bg-neutral-100"
                        onClick={() => setCelula({ data: d, turno: t })}
                        disabled={carregando}
                      >
                        {escalados.length === 0 ? (
                          <span className="text-neutral-400">+ Escolher</span>
                        ) : (
                          <ul className="space-y-1">
                            {escalados.map((e) => (
                              <li key={e.id} className="leading-tight">
                                {nomePorId.get(e.funcionario_id)?.nome ?? "?"}
                              </li>
                            ))}
                          </ul>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {carregando && <p className="p-3 text-neutral-600">Carregando...</p>}
      </div>

      {celula && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCelula(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              {celula.turno.nome} · {DIAS_SEMANA[paraData(celula.data).getDay()]}{" "}
              {diaMes(celula.data)}
            </h2>
            <p className="mb-3 text-sm text-neutral-600">Marque quem trabalha. Salva na hora.</p>
            {erro && <p className="mb-3 text-red-700">{erro}</p>}
            <ul className="space-y-2">
              {opcoesCelula.map((f) => {
                const marcado = escalas.some(
                  (e) =>
                    e.data === celula.data &&
                    e.turno_id === celula.turno.id &&
                    e.funcionario_id === f.id,
                );
                return (
                  <li key={f.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        marcado ? "border-neutral-500 bg-neutral-50" : "border-neutral-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-6 w-6"
                        checked={marcado}
                        disabled={gravando !== null}
                        onChange={() => alternar(f)}
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{f.nome}</span>
                        <span className="block text-sm text-neutral-600">
                          {f.funcao}
                          {!f.ativo && " · desativado"}
                        </span>
                      </span>
                      {gravando === f.id && (
                        <span className="text-sm text-neutral-500">salvando...</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <button className="botao mt-4 w-full" onClick={() => setCelula(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
