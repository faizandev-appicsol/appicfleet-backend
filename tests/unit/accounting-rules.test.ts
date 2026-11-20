import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  ACCOUNT_TYPES,
  JOURNAL_STATUSES,
  PERIOD_STATUSES,
  type JournalStatus,
  type PeriodStatus,
} from '../../src/constants/accounting.js'
import {
  JOURNAL_TRANSITIONS,
  PERIOD_TRANSITIONS,
  addSignedMoney,
  canTransitionJournal,
  canTransitionPeriod,
  isJournalBalanced,
  journalDifference,
  normalBalanceForType,
  periodContainsDate,
  signedMovement,
  sumCredits,
  sumDebits,
  validateJournalLineAmounts,
  wouldCreateAccountCycle,
} from '../../src/services/accounting/accounting-rules.js'

const J = JOURNAL_STATUSES
const P = PERIOD_STATUSES

describe('journal status transitions', () => {
  const allowed: Record<JournalStatus, JournalStatus[]> = {
    [J.DRAFT]: [J.POSTED, J.CANCELLED],
    [J.POSTED]: [J.REVERSED],
    [J.REVERSED]: [],
    [J.CANCELLED]: [],
  }

  it('allows exactly the specified transitions and denies every other pair', () => {
    for (const from of Object.values(J)) {
      for (const to of Object.values(J)) {
        assert.equal(canTransitionJournal(from, to), allowed[from].includes(to), `${from} -> ${to}`)
        assert.deepEqual([...JOURNAL_TRANSITIONS[from]], allowed[from])
      }
    }
  })

  it('denies edits after posting except reversal', () => {
    assert.equal(canTransitionJournal(J.POSTED, J.DRAFT), false)
    assert.equal(canTransitionJournal(J.POSTED, J.CANCELLED), false)
    assert.equal(canTransitionJournal(J.REVERSED, J.POSTED), false)
  })
})

describe('fiscal period transitions', () => {
  const allowed: Record<PeriodStatus, PeriodStatus[]> = {
    [P.OPEN]: [P.CLOSED],
    [P.CLOSED]: [P.OPEN, P.LOCKED],
    [P.LOCKED]: [],
  }

  it('allows open→closed, closed→open/locked, and denies locked reopen', () => {
    for (const from of Object.values(P)) {
      for (const to of Object.values(P)) {
        assert.equal(canTransitionPeriod(from, to), allowed[from].includes(to), `${from} -> ${to}`)
        assert.deepEqual([...PERIOD_TRANSITIONS[from]], allowed[from])
      }
    }
  })
})

describe('journal line validation and balance', () => {
  it('rejects lines with both debit and credit, zero lines, and invalid amounts', () => {
    assert.equal(validateJournalLineAmounts({ debit: '10.00', credit: '5.00' }), 'BOTH_DEBIT_AND_CREDIT')
    assert.equal(validateJournalLineAmounts({ debit: '0.00', credit: '0.00' }), 'ZERO_LINE')
    assert.equal(validateJournalLineAmounts({ debit: '-1.00', credit: '0.00' }), 'INVALID_AMOUNT')
    assert.equal(validateJournalLineAmounts({ debit: '10.00', credit: '0.00' }), null)
  })

  it('requires at least two lines and equal debit/credit totals', () => {
    assert.equal(isJournalBalanced([{ debit: '100.00', credit: '0.00' }]), false)
    assert.equal(
      isJournalBalanced([
        { debit: '100.00', credit: '0.00' },
        { debit: '0.00', credit: '100.00' },
      ]),
      true,
    )
    assert.equal(
      isJournalBalanced([
        { debit: '100.00', credit: '0.00' },
        { debit: '0.00', credit: '90.00' },
      ]),
      false,
    )
    assert.equal(
      journalDifference([
        { debit: '100.00', credit: '0.00' },
        { debit: '0.00', credit: '90.00' },
      ]),
      '10.00',
    )
    assert.equal(sumDebits([{ debit: '10.50' }, { debit: '0.50' }]), '11.00')
    assert.equal(sumCredits([{ credit: '5.25' }, { credit: '4.75' }]), '10.00')
  })
})

describe('running balance helpers', () => {
  it('applies debit-normal and credit-normal signed movements', () => {
    assert.equal(signedMovement('DEBIT', '100.00', '0.00'), '100.00')
    assert.equal(signedMovement('DEBIT', '0.00', '40.00'), '-40.00')
    assert.equal(signedMovement('CREDIT', '0.00', '100.00'), '100.00')
    assert.equal(signedMovement('CREDIT', '25.00', '0.00'), '-25.00')
  })

  it('adds signed money for running balances', () => {
    assert.equal(addSignedMoney('100.00', '25.00'), '125.00')
    assert.equal(addSignedMoney('100.00', '-40.00'), '60.00')
    assert.equal(addSignedMoney('-10.00', '-5.00'), '-15.00')
    assert.equal(addSignedMoney('-10.00', '25.00'), '15.00')
  })
})

describe('chart of accounts helpers', () => {
  it('maps account types to normal balances', () => {
    assert.equal(normalBalanceForType(ACCOUNT_TYPES.ASSET), 'DEBIT')
    assert.equal(normalBalanceForType(ACCOUNT_TYPES.EXPENSE), 'DEBIT')
    assert.equal(normalBalanceForType(ACCOUNT_TYPES.LIABILITY), 'CREDIT')
    assert.equal(normalBalanceForType(ACCOUNT_TYPES.EQUITY), 'CREDIT')
    assert.equal(normalBalanceForType(ACCOUNT_TYPES.REVENUE), 'CREDIT')
  })

  it('detects parent cycles', () => {
    const parentById = new Map<string, string | undefined>([
      ['a', undefined],
      ['b', 'a'],
      ['c', 'b'],
    ])
    assert.equal(wouldCreateAccountCycle('a', 'c', parentById), true)
    assert.equal(wouldCreateAccountCycle('a', 'a', parentById), true)
    assert.equal(wouldCreateAccountCycle('c', undefined, parentById), false)
    assert.equal(wouldCreateAccountCycle('b', 'x', parentById), false)
  })
})

describe('period date coverage', () => {
  it('includes accounting dates on both period boundaries', () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-31T23:59:59.000Z')
    assert.equal(periodContainsDate(start, end, start), true)
    assert.equal(periodContainsDate(start, end, end), true)
    assert.equal(periodContainsDate(start, end, new Date('2025-12-31T23:59:59.000Z')), false)
    assert.equal(periodContainsDate(start, end, new Date('2026-02-01T00:00:00.000Z')), false)
  })
})
