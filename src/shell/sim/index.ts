// Tier 2 simulation modules. Each module owns one slice of the pretend machine
// (users and groups, systemd, networking, Docker, Python environments) and
// registers its commands here. commands.ts calls installSims once the base
// command table exists, so a module may wrap a base command (like ls or chmod).
import type { Command } from '../commands'
import type { Shell } from '../shell'
import { install as users } from './users'
import { install as systemd } from './systemd'
import { install as net } from './net'
import { install as docker } from './docker'
import { install as pyenv } from './pyenv'

export type CommandTable = Record<string, Command>

export function installSims(base: CommandTable) {
  users(base)
  systemd(base)
  net(base)
  docker(base)
  pyenv(base)
}

/** Lazily created, typed state slot for one module. Stored under sh.state.sims[name] so checkers can read it. */
export function simState<T>(sh: Shell, name: string, init: () => T): T {
  const sims = sh.state.sims
  if (!(name in sims)) sims[name] = init()
  return sims[name] as T
}
