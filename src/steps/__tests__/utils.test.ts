import { QualyNumericSeverity } from '../../types';
import {
  convertNumericSeverityToString,
  normalizeNumericSeverity,
} from '../utils';

describe('normalizeNumericSeverity', () => {
  test('undefined', () => {
    expect(normalizeNumericSeverity(undefined)).toBe(1);
  });

  test('< 0', () => {
    expect(normalizeNumericSeverity(-1 as QualyNumericSeverity)).toBe(1);
  });

  test('> 5', () => {
    expect(normalizeNumericSeverity(6 as QualyNumericSeverity)).toBe(10);
  });

  test('1', () => {
    expect(normalizeNumericSeverity(1)).toBe(1);
  });

  test('2', () => {
    expect(normalizeNumericSeverity(2)).toBe(4);
  });

  test('3', () => {
    expect(normalizeNumericSeverity(3)).toBe(6);
  });

  test('4', () => {
    expect(normalizeNumericSeverity(4)).toBe(8);
  });

  test('5', () => {
    expect(normalizeNumericSeverity(5)).toBe(10);
  });
});

describe('convertNumericSeverityToString', () => {
  test('undefined', () => {
    expect(convertNumericSeverityToString(undefined)).toBe('Informational');
  });

  test('< 0', () => {
    expect(convertNumericSeverityToString(-1 as QualyNumericSeverity)).toBe(
      'Informational',
    );
  });

  test('> 5', () => {
    expect(convertNumericSeverityToString(6 as QualyNumericSeverity)).toBe(
      'Critical',
    );
  });

  test('1', () => {
    expect(convertNumericSeverityToString(1)).toBe('Informational');
  });

  test('2', () => {
    expect(convertNumericSeverityToString(2)).toBe('Low');
  });

  test('3', () => {
    expect(convertNumericSeverityToString(3)).toBe('Medium');
  });

  test('4', () => {
    expect(convertNumericSeverityToString(4)).toBe('High');
  });

  test('5', () => {
    expect(convertNumericSeverityToString(5)).toBe('Critical');
  });
});
