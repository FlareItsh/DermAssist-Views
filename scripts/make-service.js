import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const name = process.argv[2]

if (!name) {
  console.error('❌ Usage: pnpm make:service <ResourceName>')
  process.exit(1)
}

const pascalCase = str => str.charAt(0).toUpperCase() + str.slice(1)
const camelCase = str => str.charAt(0).toLowerCase() + str.slice(1)
const kebabCase = str => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

const cleanName = name.replace(/Service$/i, '')
const resourceName = pascalCase(cleanName)
const folderName = kebabCase(cleanName)

const getPlural = (str) => {
  const lower = str.toLowerCase()
  if (lower.endsWith('sis')) {
    return str.slice(0, -3) + 'ses'
  }
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    return str.slice(0, -1) + 'ies'
  }
  return str + 's'
}

const endpointName = getPlural(kebabCase(cleanName))
const variableName = camelCase(cleanName)

const targetDir = path.join(__dirname, '..', 'app', 'api', folderName)
const targetFile = path.join(targetDir, `${resourceName}Service.ts`)

const fileContent = `import { BaseService } from '../BaseService'

export class ${resourceName}Service extends BaseService {
  private resource = '/${endpointName}'

  async list(params: object = {}): Promise<any> {
    return await this.request(this.resource, 'GET', params)
  }

  async create(payload: object): Promise<any> {
    return await this.request(this.resource, 'POST', payload)
  }

  async show(uuid: string): Promise<any> {
    return await this.request(\`\${this.resource}/\${uuid}\`, 'GET')
  }

  async update(uuid: string, payload: object): Promise<any> {
    return await this.request(\`\${this.resource}/\${uuid}\`, 'PUT', payload)
  }

  async delete(uuid: string): Promise<any> {
    return await this.request(\`\${this.resource}/\${uuid}\`, 'DELETE')
  }

  async restore(uuid: string): Promise<any> {
    return await this.request(\`\${this.resource}/\${uuid}/restore\`, 'POST')
  }
}

export const ${variableName}Service = new ${resourceName}Service()
`

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

if (fs.existsSync(targetFile)) {
  console.error(`❌ File already exists: ${targetFile}`)
} else {
  fs.writeFileSync(targetFile, fileContent)
  console.log(`✅ Created Service: api/${folderName}/${resourceName}Service.ts`)
}
