'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccountAlreadyLinkedError, upsert } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { parseForm, submittedValues, type SaveResult } from '@/app/form-schema'

export async function save(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  const values = submittedValues(form)

  let fields
  try {
    fields = parseForm(form)
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0]?.message : undefined
    return { ok: false, message: issue ?? 'Please check the form and try again.', values }
  }

  // Links made in this session; anything omitted here is preserved by the
  // upsert's COALESCE rather than read back first — see contributors.ts.
  const telegram = session.pending?.telegram
  const discord = session.pending?.discord

  try {
    await upsert({
      githubId: session.github.id,
      githubLogin: session.github.login,
      telegramId: telegram?.providerId,
      telegramUsername: telegram?.username,
      telegramPhone: telegram?.phone,
      discordId: discord?.providerId,
      discordUsername: discord?.username,
      ...fields,
    })
  } catch (error) {
    if (error instanceof AccountAlreadyLinkedError) {
      // Only the identity that actually conflicted belongs to someone else —
      // drop just that one, leaving any other pending link untouched, or
      // the contributor would be stuck resubmitting a stranger's account.
      if (error.provider === 'telegram') session.pending = { ...session.pending, telegram: undefined }
      else session.pending = { ...session.pending, discord: undefined }
      await session.save()
      return { ok: false, message: error.message, values }
    }
    // No admin UI reads this row, so the container log is the only place a
    // genuine failure (as opposed to a routine conflict, handled above)
    // leaves a trace. The contributor still gets the same generic message.
    console.error('save action failed:', error)
    return { ok: false, message: 'Could not save right now. Please try again in a moment.', values }
  }

  session.pending = undefined
  await session.save()
  revalidatePath('/')
  return { ok: true }
}
