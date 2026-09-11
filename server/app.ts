import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { ZodError } from 'zod'
import companyRoutes from './routes/companies.js'
import opportunityRoutes from './routes/opportunities.js'
import scanRoutes from './routes/scans.js'

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/companies', companyRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/scans', scanRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  void req
  void next

  console.error('Server error:', error)
  console.error('Server error stack:', error.stack)

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Parametres invalides',
      details: error.flatten(),
    })
    return
  }

  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Erreur interne du serveur',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app