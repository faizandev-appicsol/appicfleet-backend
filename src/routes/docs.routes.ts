import { Router } from 'express'
import { openApiDocument } from '../docs/openapi.js'

export const docsRouter = Router()

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument)
})
