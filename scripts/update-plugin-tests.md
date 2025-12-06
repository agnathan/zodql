# Test Reporting Update Guide

The graphql-operations-plugin.test.ts file has been partially updated with test reporting. 

## Pattern to Follow

For each async test that generates plugin output, wrap it like this:

```typescript
it('should generate mutation operation', async () => {
  const zodqlCode = `
const User = defineObject('User', {
  fields: {
    id: Scalars.ID,
    name: Scalars.String,
  },
});

const CreateUserInput = defineInput('CreateUserInput', {
  name: Scalars.String,
  email: Scalars.String,
});

const generator = new GraphQLSchemaGenerator('User', {
  schema: User,
  inputs: {
    create: CreateUserInput,
  },
  mutations: {
    createUser: field({ input: CreateUserInput }, User),
  },
});

const plugin = new GraphQLOperationsPlugin();
const results = await pluginManager.runPlugins(generator);
`.trim();

  await withTestCapture(zodqlCode, async () => {
    // Original test code here
    const User = defineObject('User', {
      fields: {
        id: Scalars.ID,
        name: Scalars.String,
      },
    });

    const CreateUserInput = defineInput('CreateUserInput', {
      name: Scalars.String,
      email: Scalars.String,
    });

    const generator = new GraphQLSchemaGenerator('User', {
      schema: User,
      inputs: {
        create: CreateUserInput,
      },
      mutations: {
        createUser: field({ input: CreateUserInput }, User),
      },
    });

    pluginManager.register(new GraphQLOperationsPlugin());
    const results = await pluginManager.runPlugins(generator);

    // Assertions...
    expect(results[0].success).toBe(true);
    
    // Capture output at the end
    capturePluginOutput(formatPluginResults(results));
  });
});
```

## Key Points

1. Extract the ZodQL code as a string in `zodqlCode`
2. Wrap the test body in `withTestCapture(zodqlCode, async () => { ... })`
3. Add `capturePluginOutput(formatPluginResults(results))` at the end of tests that generate output
4. For validation-only tests (no output), you can skip the capture or capture a simple message

## Tests Already Updated

- ✅ should generate query operation without arguments
- ✅ should generate query operation with arguments  
- ✅ should generate query with optional arguments

## Tests Still Needing Updates

All other async tests that call `pluginManager.runPlugins()` need to be wrapped with `withTestCapture`.
