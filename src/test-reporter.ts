import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

interface TestResult {
  testDescription: string; // The "it" description
  describeBlock: string; // The "describe" block name
  testFileName: string; // The test file name (e.g., "graphql-schema-generator.test.ts")
  passed: boolean;
  zodqlInput: string;
  output: string;
  error?: string;
}

const testResults: TestResult[] = [];
let currentTest: Partial<TestResult> = {};

/**
 * Set the current test file name for test organization
 */
export function setTestFileName(testFileName: string) {
  currentTest.testFileName = testFileName;
}

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
      testFileName: currentTest.testFileName || 'unknown.test.ts',
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

  // First, group tests by test file name
  const testsByFile = new Map<string, Map<string, TestResult[]>>();
  for (const result of testResults) {
    const fileName = result.testFileName;
    if (!testsByFile.has(fileName)) {
      testsByFile.set(fileName, new Map());
    }
    const fileMap = testsByFile.get(fileName)!;
    
    // Then group by describe block within each file
    const blockName = result.describeBlock;
    if (!fileMap.has(blockName)) {
      fileMap.set(blockName, []);
    }
    fileMap.get(blockName)!.push(result);
  }

  // Write tests organized by test file, then by describe block
  for (const [testFileName, describeBlocks] of testsByFile.entries()) {
    const sanitizedFileName = sanitizeForFileSystem(testFileName);
    const testFileDir = join(baseDir, sanitizedFileName);
    mkdirSync(testFileDir, { recursive: true });

    for (const [describeBlock, tests] of describeBlocks.entries()) {
      const sanitizedBlockName = sanitizeForFileSystem(describeBlock);
      const describeDir = join(testFileDir, sanitizedBlockName);
      mkdirSync(describeDir, { recursive: true });

      for (const result of tests) {
        const status = result.passed ? 'PASSED' : 'FAILED';
        // Use the test description directly (sanitized for filesystem safety)
        const sanitizedDescription = sanitizeForFileSystem(result.testDescription);
        const fileName = `${sanitizedDescription}_${status}.txt`;
        const filePath = join(describeDir, fileName);

        const content = [
          '='.repeat(60),
          `TEST FILE: ${result.testFileName}`,
          `DESCRIBE BLOCK: ${result.describeBlock}`,
          `TEST: ${result.testDescription}`,
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
  }

  console.log(`\n📊 Test summaries written to: test-results/${dirName}/`);
  console.log(`   ${testResults.length} test(s) across ${testsByFile.size} test file(s) and ${Array.from(testsByFile.values()).reduce((sum, map) => sum + map.size, 0)} describe block(s)\n`);
}

