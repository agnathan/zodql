import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

interface TestResult {
  testName: string;
  passed: boolean;
  zodqlInput: string;
  output: string;
  error?: string;
}

const testResults: TestResult[] = [];
let currentTest: Partial<TestResult> = {};

export function captureTestInput(testName: string, zodqlCode: string) {
  currentTest.testName = testName;
  currentTest.zodqlInput = zodqlCode;
}

export function captureTestOutput(output: string) {
  currentTest.output = output;
}

export function getCurrentTest() {
  return currentTest;
}

export function captureTestError(error: string) {
  currentTest.error = error;
}

export function finalizeTest(passed: boolean) {
  if (currentTest.testName) {
    testResults.push({
      testName: currentTest.testName,
      passed,
      zodqlInput: currentTest.zodqlInput || '',
      output: currentTest.output || '',
      error: currentTest.error,
    });
  }
  currentTest = {};
}

export function writeTestSummaries() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-15T10-30-45
  const dirName = `test-results-${timestamp}`;
  const baseDir = join(process.cwd(), 'test-results', dirName);

  mkdirSync(baseDir, { recursive: true });

  for (const result of testResults) {
    const status = result.passed ? 'PASSED' : 'FAILED';
    const fileName = `${result.testName.replace(/[^a-zA-Z0-9]/g, '_')}_${status}.txt`;
    const filePath = join(baseDir, fileName);

    const content = [
      '='.repeat(60),
      `TEST: ${result.testName}`,
      `STATUS: ${status}`,
      '='.repeat(60),
      '',
      'ZODQL INPUT:',
      '-'.repeat(60),
      result.zodqlInput,
      '',
      'OUTPUT:',
      '-'.repeat(60),
      result.output,
      '',
    ];

    if (result.error) {
      content.push('ERROR:', '-'.repeat(60), result.error, '');
    }

    content.push('='.repeat(60));

    writeFileSync(filePath, content.join('\n'), 'utf-8');
  }

  console.log(`\n📊 Test summaries written to: test-results/${dirName}/`);
  console.log(`   ${testResults.length} test(s) documented\n`);
}

