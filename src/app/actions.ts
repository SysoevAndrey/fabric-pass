'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccountAlreadyLinkedError, findByGithubId, upsert } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { parseForm, type SaveResult } from '@/app/form-schema'

export async function save(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  let fields
  try {
    fields = parseForm(form)
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0]?.message : undefined
    return { ok: false, message: issue ?? 'Please check the form and try again.' }
  }

  // Existing links come from the record; links made in this session win.
  const existing = await findByGithubId(session.github.id)
  const telegram = session.pending?.telegram
  const discord = session.pending?.discord

  try {
    await upsert({
      githubId: session.github.id,
      githubLogin: session.github.login,
      telegramId: telegram?.providerId ?? existing?.telegramId,
      telegramUsername: telegram ? telegram.username : existing?.telegramUsername,
      telegramPhone: telegram ? telegram.phone : existing?.telegramPhone,
      discordId: discord?.providerId ?? existing?.discordId,
      discordUsername: discord ? discord.username : existing?.discordUsername,
      ...fields,
    })
  } catch (error) {
    if (error instanceof AccountAlreadyLinkedError) return { ok: false, message: error.message }
    return { ok: false, message: 'Could not save right now. Please try again in a moment.' }
  }

  session.pending = undefined
  await session.save()
  revalidatePath('/')
  return { ok: true }
}
