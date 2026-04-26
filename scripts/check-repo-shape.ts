import { createRepoShapeContext } from './repo-shape/context'
import { checkImports } from './repo-shape/imports'
import {
    checkMarkdownFiles,
    checkStaleReferences,
} from './repo-shape/references'
import { checkRepoStructure } from './repo-shape/structure'
import { checkWebBuildManifest } from './repo-shape/web-build'

const context = createRepoShapeContext()

checkRepoStructure(context)
checkMarkdownFiles(context)
checkImports(context)
checkStaleReferences(context)
checkWebBuildManifest(context)

if (context.violations.length > 0) {
    console.error('Repo shape check failed:\n')
    for (const violation of context.violations) console.error(`- ${violation}`)
    process.exit(1)
}

console.log('Repo shape check passed')
