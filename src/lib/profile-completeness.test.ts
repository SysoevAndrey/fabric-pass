import { expect, test } from 'vitest'
import { missingMandatoryFields } from './profile-completeness.ts'

const complete = { name: 'Ada Lovelace', email: 'ada@example.com', company: 'Constructor', discordUsername: 'ada' }

test('nothing is missing when every mandatory field is filled in', () => {
  expect(missingMandatoryFields(complete)).toEqual([])
})

test('a blank name is reported as missing, as Full Name', () => {
  expect(missingMandatoryFields({ ...complete, name: '  ' })).toEqual(['Full Name'])
})

test('a blank email is reported as missing', () => {
  expect(missingMandatoryFields({ ...complete, email: '' })).toEqual(['Email'])
})

test('a blank company is reported as missing', () => {
  expect(missingMandatoryFields({ ...complete, company: '  ' })).toEqual(['Company'])
})

test('an unlinked discord is reported as missing', () => {
  expect(missingMandatoryFields({ ...complete, discordUsername: undefined })).toEqual(['Discord'])
})

test('every blank field is reported together, in field order', () => {
  expect(missingMandatoryFields({ name: '', email: '', company: '', discordUsername: undefined })).toEqual([
    'Full Name',
    'Email',
    'Company',
    'Discord',
  ])
})
