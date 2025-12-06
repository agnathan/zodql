import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

interface TestResult {
  testDescription: string; // The "it" description
  describeBlock: string; // The "describe" block name
  passed: boolean;
  zodqlInput: string;
  output: string;
  error?: string;
}

const testResults: TestResult[] = [];
let currentTest: Partial<TestResult> = {};

/**
 * Set the current describe block name for test organization
 */
export function setDescribeBlock(describeBlock: string) {
  currentTest.describeBlock = describeBlock;
}

/**
 * Capture test input code and test description
 */
export function captureTestInput(testDescription: string, zodqlCode: string) {
  currentTest.testDescription = testDescription;
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
  if (currentTest.testDescription) {
    testResults.push({
      testDescription: currentTest.testDescription,
      describeBlock: currentTest.describeBlock || 'Uncategorized',
      passed,
      zodqlInput: currentTest.zodqlInput || '',
      output: currentTest.output || '',
      error: currentTest.error,
    });
  }
  currentTest = {};
}

/**
 * Sanitize a string to be safe for use as a directory or filename
 */
function sanitizeForFileSystem(name: string): string {
  // Replace invalid filesystem characters with underscores
  // Keep spaces, hyphens, and underscores, but remove other special chars
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function writeTestSummaries() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2024-01-15T10-30-45
  const dirName = `test-results-${timestamp}`;
  const baseDir = join(process.cwd(), 'test-results', dirName);

  mkdirSync(baseDir, { recursive: true });

  // Group tests by describe block
  const testsByDescribe = new Map<string, TestResult[]>();
  for (const result of testResults) {
    const blockName = result.describeBlock;
    if (!testsByDescribe.has(blockName)) {
      testsByDescribe.set(blockName, []);
    }
    testsByDescribe.get(blockName)!.push(result);
  }

  // Write tests organized by describe block
  for (const [describeBlock, tests] of testsByDescribe.entries()) {
    const sanitizedBlockName = sanitizeForFileSystem(describeBlock);
    const describeDir = join(baseDir, sanitizedBlockName);
    mkdirSync(describeDir, { recursive: true });

    for (const result of tests) {
      const status = result.passed ? 'PASSED' : 'FAILED';
      // Use the test description directly (sanitized for filesystem safety)
      const sanitizedDescription = sanitizeForFileSystem(result.testDescription);
      const fileName = `${sanitizedDescription}_${status}.txt`;
      const filePath = join(describeDir, fileName);

      const content = [
        '='.repeat(60),
        `TEST: ${result.testDescription}`,
        `DESCRIBE BLOCK: ${result.describeBlock}`,
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
  }

  console.log(`\n📊 Test summaries written to: test-results/${dirName}/`);
  console.log(`   ${testResults.length} test(s) across ${testsByDescribe.size} describe block(s)\n`);
}

