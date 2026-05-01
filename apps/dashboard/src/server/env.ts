import { z } from 'zod'

const envSchema = z.object({
    DASHBOARD_HOST: z.string().min(1).default('127.0.0.1'),
    DASHBOARD_PORT: z.coerce.number().int().positive().default(4010),
    DASHBOARD_TIME_ZONE: z.string().min(1).default('Europe/London'),
    DATABASE_URL: z.string().min(1),
})

export type DashboardConfig = z.infer<typeof envSchema>

export function readDashboardConfig(
    env: NodeJS.ProcessEnv = process.env,
): DashboardConfig {
    return envSchema.parse(env)
}
