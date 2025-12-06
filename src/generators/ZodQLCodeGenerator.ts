/**
 * =================================================================================
 * ZodQLCodeGenerator.ts
 * =================================================================================
 *
 * This class generates ZodQL code from a GraphQL Schema Definition Language (SDL) string.
 * It parses the GraphQL schema and converts it to equivalent ZodQL TypeScript code.
 *
 * This is the reverse operation of GraphQLSchemaGenerator.
 */

import { parse, DocumentNode, visit, TypeDefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, EnumTypeDefinitionNode, UnionTypeDefinitionNode, InterfaceTypeDefinitionNode, ObjectTypeDefinitionNode, InputObjectTypeDefinitionNode, ScalarTypeDefinitionNode, NamedTypeNode, ListTypeNode, NonNullTypeNode, TypeNode } from 'graphql';
import { Scalars } from '../zodql/scalars.js';

/**
 * Options for ZodQL code generation
 */
export interface ZodQLCodeGeneratorOptions {
  /** Whether to include imports at the top */
  includeImports?: boolean;
  
  /** Whether to format the output code */
  formatOutput?: boolean;
  
  /** Entity name to use for the main type (if not found in schema) */
  defaultEntityName?: string;
}

/**
 * Generates ZodQL code from GraphQL SDL
 */
export class ZodQLCodeGenerator {
  private typeDefinitions = new Map<string, TypeDefinitionNode>();
  private generatedTypes = new Set<string>();
  private scalars = new Set<string>();
  private enums = new Map<string, string[]>();
  private interfaces = new Map<string, readonly FieldDefinitionNode[]>();
  private unions = new Map<string, string[]>();
  private inputs = new Map<string, readonly InputValueDefinitionNode[]>();
  private objects = new Map<string, { fields: readonly FieldDefinitionNode[]; interfaces?: string[] }>();
  private queries: readonly FieldDefinitionNode[] = [];
  private mutations: readonly FieldDefinitionNode[] = [];
  private subscriptions: readonly FieldDefinitionNode[] = [];

  constructor(private options: ZodQLCodeGeneratorOptions = {}) {}

  /**
   * Generate ZodQL code from GraphQL SDL string
   */
  public generateZodQLCode(graphQLSchema: string): string {
    // Parse GraphQL schema
    const document = parse(graphQLSchema);
    
    // Extract type definitions
    this.extractDefinitions(document);
    
    // Generate ZodQL code
    const code: string[] = [];
    
    if (this.options.includeImports !== false) {
      code.push(this.generateImports());
    }
    
    // Generate scalars
    code.push(...this.generateScalars());
    
    // Generate enums
    code.push(...this.generateEnums());
    
    // Generate interfaces
    code.push(...this.generateInterfaces());
    
    // Generate unions
    code.push(...this.generateUnions());
    
    // Generate input types
    code.push(...this.generateInputTypes());
    
    // Generate object types
    code.push(...this.generateObjectTypes());
    
    // Generate root operations
    code.push(...this.generateRootOperations());
    
    return code.filter(Boolean).join('\n\n');
  }

  /**
   * Extract all definitions from the GraphQL document
   */
  private extractDefinitions(document: DocumentNode): void {
    const self = this;
    
    visit(document, {
      ScalarTypeDefinition(node: ScalarTypeDefinitionNode) {
        self.scalars.add(node.name.value);
      },
      
      EnumTypeDefinition(node: EnumTypeDefinitionNode) {
        const values = node.values?.map(v => v.name.value) || [];
        self.enums.set(node.name.value, values);
        self.typeDefinitions.set(node.name.value, node);
      },
      
      InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode) {
        const fields = node.fields || [];
        self.interfaces.set(node.name.value, fields);
        self.typeDefinitions.set(node.name.value, node);
      },
      
      UnionTypeDefinition(node: UnionTypeDefinitionNode) {
        const types = node.types?.map(t => t.name.value) || [];
        self.unions.set(node.name.value, types);
        self.typeDefinitions.set(node.name.value, node);
      },
      
      InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode) {
        const fields = node.fields || [];
        self.inputs.set(node.name.value, fields);
        self.typeDefinitions.set(node.name.value, node);
      },
      
      ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
        const typeName = node.name.value;
        const fields = node.fields || [];
        const interfaces = node.interfaces?.map(i => i.name.value) || [];
        
        if (typeName === 'Query') {
          self.queries = fields;
        } else if (typeName === 'Mutation') {
          self.mutations = fields;
        } else if (typeName === 'Subscription') {
          self.subscriptions = fields;
        } else {
          self.objects.set(typeName, { fields, interfaces: interfaces.length > 0 ? interfaces : undefined });
          self.typeDefinitions.set(typeName, node);
        }
      },
    });
  }

  /**
   * Generate import statements
   */
  private generateImports(): string {
    return `import { z } from 'zod';
import { Scalars, defineEnum, defineInput, defineInterface, defineObject, defineUnion, field, register } from 'zodql';
import { GraphQLSchemaGenerator } from 'zodql';`;
  }

  /**
   * Generate scalar type definitions
   */
  private generateScalars(): string[] {
    const code: string[] = [];
    
    for (const scalar of this.scalars) {
      if (!['ID', 'String', 'Int', 'Float', 'Boolean', 'DateTime', 'JSON'].includes(scalar)) {
        // Custom scalar
        code.push(`const ${scalar} = register('${scalar}', z.string());`);
      }
    }
    
    return code;
  }

  /**
   * Generate enum definitions
   */
  private generateEnums(): string[] {
    const code: string[] = [];
    
    for (const [name, values] of this.enums.entries()) {
      const valuesStr = values.map(v => `"${v}"`).join(', ');
      code.push(`const ${name} = defineEnum('${name}', [${valuesStr}]);`);
    }
    
    return code;
  }

  /**
   * Generate interface definitions
   */
  private generateInterfaces(): string[] {
    const code: string[] = [];
    
    for (const [name, fields] of this.interfaces.entries()) {
      const fieldsCode = this.generateFieldsCode(fields, false);
      code.push(`const ${name} = defineInterface('${name}', {\n  fields: {\n${fieldsCode}\n  },\n});`);
    }
    
    return code;
  }

  /**
   * Generate union definitions
   */
  private generateUnions(): string[] {
    const code: string[] = [];
    
    for (const [name, types] of this.unions.entries()) {
      const typesStr = types.join(', ');
      code.push(`const ${name} = defineUnion('${name}', [${typesStr}]);`);
    }
    
    return code;
  }

  /**
   * Generate input type definitions
   */
  private generateInputTypes(): string[] {
    const code: string[] = [];
    
    for (const [name, fields] of this.inputs.entries()) {
      const fieldsCode = this.generateInputFieldsCode(fields);
      code.push(`const ${name} = defineInput('${name}', {\n${fieldsCode}\n});`);
    }
    
    return code;
  }

  /**
   * Generate object type definitions
   */
  private generateObjectTypes(): string[] {
    const code: string[] = [];
    
    for (const [name, { fields, interfaces }] of this.objects.entries()) {
      const fieldsCode = this.generateFieldsCode(fields, false);
      const implementsStr = interfaces && interfaces.length > 0 
        ? `,\n  implements: [${interfaces.join(', ')}]`
        : '';
      code.push(`const ${name} = defineObject('${name}', {\n  fields: {\n${fieldsCode}\n  }${implementsStr},\n});`);
    }
    
    return code;
  }

  /**
   * Generate root operations (Query, Mutation, Subscription)
   */
  private generateRootOperations(): string[] {
    const code: string[] = [];
    
    if (this.queries.length > 0 || this.mutations.length > 0 || this.subscriptions.length > 0) {
      const entityName = this.options.defaultEntityName || this.findMainEntityName();
      
      const queriesCode = this.queries.length > 0 
        ? this.generateOperationsCode(this.queries, 'queries')
        : '';
      const mutationsCode = this.mutations.length > 0
        ? this.generateOperationsCode(this.mutations, 'mutations')
        : '';
      const subscriptionsCode = this.subscriptions.length > 0
        ? this.generateOperationsCode(this.subscriptions, 'subscriptions')
        : '';
      
      code.push(`const generator = new GraphQLSchemaGenerator('${entityName}', {`);
      
      // Add schema if main entity exists
      if (this.objects.has(entityName)) {
        code.push(`  schema: ${entityName},`);
      }
      
      // Add inputs
      if (this.inputs.size > 0) {
        const inputsCode = Array.from(this.inputs.keys())
          .map(name => `    ${name.toLowerCase()}: ${name},`)
          .join('\n');
        code.push(`  inputs: {\n${inputsCode}\n  },`);
      }
      
      // Add operations
      if (queriesCode) code.push(queriesCode);
      if (mutationsCode) code.push(mutationsCode);
      if (subscriptionsCode) code.push(subscriptionsCode);
      
      code.push(`});`);
      code.push(``);
      code.push(`const schema = generator.generateSchemaFile();`);
    }
    
    return code;
  }

  /**
   * Generate operations code (queries, mutations, subscriptions)
   */
  private generateOperationsCode(fields: readonly FieldDefinitionNode[], operationType: 'queries' | 'mutations' | 'subscriptions'): string {
    const operations: string[] = [];
    
    for (const field of fields) {
      const fieldName = field.name.value;
      const args = field.arguments || [];
      const returnType = this.graphQLTypeToZodQL(field.type, false);
      
      if (args.length > 0) {
        const argsCode = args.map(arg => {
          const argType = this.graphQLTypeToZodQL(arg.type, true); // Arguments are inputs
          return `      ${arg.name.value}: ${argType}`;
        }).join(',\n');
        operations.push(`    ${fieldName}: field({\n${argsCode}\n    }, ${returnType}),`);
      } else {
        operations.push(`    ${fieldName}: field({}, ${returnType}),`);
      }
    }
    
    return `  ${operationType}: {\n${operations.join('\n')}\n  },`;
  }

  /**
   * Generate fields code for object/interface types
   */
  private generateFieldsCode(fields: readonly FieldDefinitionNode[], isInput: boolean): string {
    return fields.map(field => {
      const fieldName = field.name.value;
      // For object/interface fields, nullable means optional (not nullable)
      const zodType = this.graphQLTypeToZodQL(field.type, false, true); // isObjectField = true
      return `    ${fieldName}: ${zodType},`;
    }).join('\n');
  }

  /**
   * Generate input fields code
   */
  private generateInputFieldsCode(fields: readonly InputValueDefinitionNode[]): string {
    return fields.map(field => {
      const fieldName = field.name.value;
      const zodType = this.graphQLTypeToZodQL(field.type, true);
      return `  ${fieldName}: ${zodType},`;
    }).join('\n');
  }

  /**
   * Convert GraphQL type to ZodQL type string
   * @param type GraphQL type node
   * @param isInput Whether this is an input type (nullable → optional)
   * @param isObjectField Whether this is an object field (nullable → optional, not nullable)
   */
  private graphQLTypeToZodQL(type: TypeNode, isInput: boolean, isObjectField: boolean = false): string {
    let zodType: string;
    let isNullable = true;
    let isOptional = false;
    let isList = false;
    let innerZodType: string;
    
    // Unwrap NonNull
    if (type.kind === 'NonNullType') {
      isNullable = false;
      type = type.type;
    }
    
    // Unwrap List
    if (type.kind === 'ListType') {
      isList = true;
      innerZodType = this.graphQLTypeToZodQL(type.type, isInput, isObjectField);
      zodType = `z.array(${innerZodType})`;
    } else if (type.kind === 'NamedType') {
      const typeName = type.name.value;
      
      // Map GraphQL scalars to ZodQL scalars
      switch (typeName) {
        case 'ID':
          zodType = 'Scalars.ID';
          break;
        case 'String':
          zodType = 'Scalars.String';
          break;
        case 'Int':
          zodType = 'Scalars.Int';
          break;
        case 'Float':
          zodType = 'Scalars.Float';
          break;
        case 'Boolean':
          zodType = 'Scalars.Boolean';
          break;
        case 'AWSDateTime':
        case 'DateTime':
          zodType = 'Scalars.DateTime';
          break;
        case 'AWSJSON':
        case 'JSON':
          zodType = 'Scalars.JSON';
          break;
        default:
          // Check if it's a registered type
          if (this.enums.has(typeName)) {
            zodType = typeName;
          } else if (this.inputs.has(typeName)) {
            zodType = typeName;
          } else if (this.objects.has(typeName)) {
            zodType = typeName;
          } else if (this.interfaces.has(typeName)) {
            zodType = typeName;
          } else if (this.unions.has(typeName)) {
            zodType = typeName;
          } else {
            zodType = typeName; // Assume it's defined elsewhere
          }
      }
    } else {
      zodType = 'Scalars.String'; // Fallback
    }
    
    // Apply optional/nullable modifiers
    // For input types and object fields, nullable means optional
    // For operation return types, nullable means nullable
    if ((isInput || isObjectField) && isNullable) {
      isOptional = true;
    }
    
    if (isOptional) {
      return `${zodType}.optional()`;
    } else if (isNullable && !isInput && !isObjectField) {
      // Only make nullable for operation return types, not object fields or inputs
      return `${zodType}.nullable()`;
    }
    
    return zodType;
  }

  /**
   * Find the main entity name (first object type that's not Query/Mutation/Subscription)
   */
  private findMainEntityName(): string {
    const objectNames = Array.from(this.objects.keys());
    return objectNames[0] || this.options.defaultEntityName || 'Entity';
  }
}
