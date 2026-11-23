import { describe, expect, it } from 'vitest'
import {
  COURIER_ESTIMATE_DEFAULTS,
  COURIER_ESTIMATE_RANGES,
  averageDeliveryFee,
  defaultCourierEstimate,
  estimateCourierEarnings,
} from '@/lib/marketing/courier-earnings'

describe('estimateCourierEarnings', () => {
  it('pays the delivery fee plus the whole tip on every delivery', () => {
    const result = estimateCourierEarnings({
      deliveriesPerDay: 8,
      averageFee: 5_000,
      averageTip: 1_000,
      days: 20,
    })
    expect(result.perDelivery).toBe(6_000)
    expect(result.perDay).toBe(48_000)
    expect(result.deliveries).toBe(160)
    expect(result.fromFees).toBe(800_000)
    expect(result.fromTips).toBe(160_000)
    expect(result.total).toBe(960_000)
  })

  it('always adds up: total is fees plus tips', () => {
    const result = estimateCourierEarnings({
      deliveriesPerDay: 3,
      averageFee: 4_500,
      averageTip: 700,
      days: 7,
    })
    expect(result.total).toBe(result.fromFees + result.fromTips)
    expect(result.total).toBe(result.perDay * 7)
  })

  it('counts no tip when the customer leaves none', () => {
    const result = estimateCourierEarnings({
      deliveriesPerDay: 5,
      averageFee: 6_000,
      averageTip: 0,
      days: 10,
    })
    expect(result.fromTips).toBe(0)
    expect(result.total).toBe(300_000)
  })

  it('works in whole pesos and whole deliveries', () => {
    const result = estimateCourierEarnings({
      deliveriesPerDay: 2.6,
      averageFee: 4_999.6,
      averageTip: 0.4,
      days: 1.2,
    })
    expect(result.deliveries).toBe(3)
    expect(result.perDelivery).toBe(5_000)
    expect(Number.isInteger(result.total)).toBe(true)
  })

  it('treats garbage and negatives as zero instead of a negative income', () => {
    const result = estimateCourierEarnings({
      deliveriesPerDay: Number.NaN,
      averageFee: -5_000,
      averageTip: Number.POSITIVE_INFINITY,
      days: -3,
    })
    expect(result.total).toBe(0)
    expect(result.perDelivery).toBe(0)
  })

  it('caps the counts at the ranges the calculator offers', () => {
    const { deliveriesPerDay, days } = COURIER_ESTIMATE_RANGES
    const result = estimateCourierEarnings({
      deliveriesPerDay: 10_000,
      averageFee: 1_000,
      averageTip: 0,
      days: 400,
    })
    expect(result.deliveries).toBe(deliveriesPerDay.max * days.max)
  })
})

describe('averageDeliveryFee', () => {
  it('averages the positive fees and rounds to the slider step', () => {
    expect(averageDeliveryFee([4_000, 5_000, 6_400])).toBe(5_000)
    expect(averageDeliveryFee([4_000, 5_000], 1_000)).toBe(5_000)
  })

  it('ignores free delivery, nulls and garbage rather than dragging the mean down', () => {
    expect(averageDeliveryFee([0, null, Number.NaN, 6_000])).toBe(6_000)
  })

  it('has no opinion without data', () => {
    expect(averageDeliveryFee([])).toBeNull()
    expect(averageDeliveryFee([0, null])).toBeNull()
  })
})

describe('defaultCourierEstimate', () => {
  it('starts from the real average fee when there is one, inside the slider range', () => {
    expect(defaultCourierEstimate(6_000).averageFee).toBe(6_000)
    expect(defaultCourierEstimate(999_000).averageFee).toBe(
      COURIER_ESTIMATE_RANGES.averageFee.max,
    )
  })

  it('falls back to the example values, and never assumes a tip', () => {
    const estimate = defaultCourierEstimate(null)
    expect(estimate).toEqual(COURIER_ESTIMATE_DEFAULTS)
    expect(estimate.averageTip).toBe(0)
  })
})
