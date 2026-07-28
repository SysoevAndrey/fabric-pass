import { z } from 'zod'

export interface SaveResult {
  ok: boolean
  message?: string
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
