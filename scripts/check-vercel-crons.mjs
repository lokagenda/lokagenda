#!/usr/bin/env node
// Valida as expressoes cron do vercel.json ANTES do push.
//
// REGRA DE OURO: vercel.json NAO e alavanca de pausa.
//  - Pra desligar um cron: REMOVA a entrada do array "crons".
//  - Pra pausar campanha: campaigns.status='paused' no banco (o cron ja filtra).
//  - NUNCA use data impossivel ("0 5 30 2 *" = 30/fev). A Vercel valida a
//    expressao e REJEITA O DEPLOY INTEIRO — travou 7 commits por 14 dias
//    (23/jul a 05/ago 2026), e o commit que "pausava" os crons nunca subiu,
//    entao eles continuaram rodando o tempo todo.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALVO = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'vercel.json')

const LIMITES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]]
const NOMES = ['minuto', 'hora', 'dia-do-mes', 'mes', 'dia-da-semana']
// Fevereiro com 29: ano bissexto existe, entao "29 2" e alcancavel. "30 2" nao.
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MAX_CRONS = 40

function expandir(campo, [min, max]) {
  const out = new Set()
  for (const parte of String(campo).split(',')) {
    const m = parte.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/)
    if (!m) return null
    const passo = m[2] ? Number(m[2]) : 1
    if (passo < 1) return null
    let ini, fim
    if (m[1] === '*') {
      ini = min
      fim = max
    } else if (m[1].includes('-')) {
      const [a, b] = m[1].split('-').map(Number)
      ini = a
      fim = b
    } else {
      ini = Number(m[1])
      fim = m[2] ? max : ini // "2/1" no campo mes significa fev..dez
    }
    if (!Number.isInteger(ini) || !Number.isInteger(fim)) return null
    if (ini < min || fim > max || ini > fim) return null
    for (let v = ini; v <= fim; v += passo) out.add(v)
  }
  return out.size ? out : null
}

function validar(schedule, ctx, erros, avisos) {
  const f = String(schedule ?? '').trim().split(/\s+/)
  if (f.length !== 5) {
    erros.push(`${ctx}: esperado 5 campos, veio ${f.length} -> "${schedule}"`)
    return
  }
  const sets = []
  for (let i = 0; i < 5; i++) {
    const s = expandir(f[i], LIMITES[i])
    if (!s) {
      erros.push(`${ctx}: campo ${NOMES[i]} invalido -> "${f[i]}" em "${schedule}"`)
      return
    }
    sets.push(s)
  }

  // A Vercel rejeita dia-do-mes e dia-da-semana restritos ao mesmo tempo.
  if (f[2] !== '*' && f[4] !== '*') {
    erros.push(
      `${ctx}: dia-do-mes E dia-da-semana restritos juntos -> "${schedule}". ` +
        `A Vercel rejeita o DEPLOY INTEIRO. Use '*' em um dos dois.`,
    )
    return
  }

  // Alcancabilidade: existe (mes, dia) valido no calendario?
  if (f[2] !== '*') {
    let ok = false
    for (const mes of sets[3]) {
      for (const dia of sets[2]) {
        if (dia <= DIAS_NO_MES[mes - 1]) {
          ok = true
          break
        }
      }
      if (ok) break
    }
    if (!ok) {
      erros.push(
        `${ctx}: DATA IMPOSSIVEL -> "${schedule}". A Vercel rejeita o DEPLOY INTEIRO. ` +
          `Pra desligar este cron REMOVA a entrada do array "crons"; ` +
          `pra pausar campanha use campaigns.status='paused' no banco.`,
      )
      return
    }
  }

  // Heuristica: pausa disfarcada de schedule raro.
  if (sets[0].size === 1 && sets[1].size === 1 && sets[2].size === 1 && sets[3].size === 1) {
    avisos.push(
      `${ctx}: dispara 1x por ano ("${schedule}"). Se a intencao era desligar, REMOVA a entrada.`,
    )
  }
}

let json
try {
  json = JSON.parse(readFileSync(ALVO, 'utf8'))
} catch (e) {
  console.error(`x  nao consegui ler/parsear ${ALVO}: ${e.message}`)
  process.exit(1)
}

const crons = json.crons
const erros = []
const avisos = []

if (crons === undefined) {
  console.log('ok  vercel.json sem bloco "crons" — nada a validar')
  process.exit(0)
}
if (!Array.isArray(crons)) {
  console.error('x  "crons" precisa ser array')
  process.exit(1)
}
if (crons.length > MAX_CRONS) {
  erros.push(`crons: ${crons.length} entradas, limite do plano Pro e ${MAX_CRONS}`)
}

const vistos = new Set()
crons.forEach((c, i) => {
  const ctx = `crons[${i}] ${c?.path ?? '(sem path)'}`
  if (typeof c?.path !== 'string' || !c.path.startsWith('/')) {
    erros.push(`${ctx}: path invalido`)
  } else if (vistos.has(c.path)) {
    erros.push(`${ctx}: path duplicado`)
  } else {
    vistos.add(c.path)
  }
  validar(c?.schedule, ctx, erros, avisos)
})

for (const a of avisos) console.warn(`!  ${a}`)
if (erros.length) {
  for (const e of erros) console.error(`x  ${e}`)
  process.exit(1)
}
console.log(`ok  ${crons.length} crons validos em ${ALVO}`)
