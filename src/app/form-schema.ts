import { z } from 'zod'

export interface SubmittedValues {
  firstName: string
  lastName: string
  email: string
  company: string
}

export interface SaveResult {
  ok: boolean
  message?: string
  /** What the contributor typed, present on every failed save so the form can re-seed from it. */
  values?: SubmittedValues
}

const formSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email('That does not look like an email address'),
  company: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
})

export function parseForm(form: FormData): z.infer<typeof formSchema> {
  return formSchema.parse({
    firstName: form.get('firstName') ?? '',
    lastName: form.get('lastName') ?? '',
    email: typeof form.get('email') === 'string' ? (form.get('email') as string).trim() : '',
    company: form.get('company') ?? '',
  })
}

/**
 * What the contributor typed, unvalidated and untrimmed. Used to re-seed the
 * form as its new `defaultValue` after any failed save — React resets
 * uncontrolled fields to their current `defaultValue` once the action
 * settles, whether or not it resolved with a business-level success.
 */
export function submittedValues(form: FormData): SubmittedValues {
  const value = (key: string) => {
    const raw = form.get(key)
    return typeof raw === 'string' ? raw : ''
  }
  return {
    firstName: value('firstName'),
    lastName: value('lastName'),
    email: value('email'),
    company: value('company'),
  }
}
