import type { FastifyInstance } from 'fastify'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../lib/db/client.js'
import { workspaces, workspaceMembers, projects } from '../../lib/db/schema.js'
import { authenticate } from '../../middleware/authenticate.js'
import { success, error } from '../../utils/response.js'

export async function workspaceRoutes(app: FastifyInstance) {

  // GET /v1/workspaces/me — get current user's workspace
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.user

    const [workspace] = await db.select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    if (!workspace) return error(reply, 404, 'WORKSPACE_NOT_FOUND', 'Workspace not found')

    const members = await db.select({
      userId:    workspaceMembers.userId,
      role:      workspaceMembers.role,
      joinedAt:  workspaceMembers.joinedAt,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))

    return success(reply, { ...workspace, memberCount: members.length })
  })

  // GET /v1/workspaces/me/projects — list projects
  app.get('/me/projects', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.user

    const projectList = await db.select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
        )
      )

    return success(reply, projectList)
  })

  // GET /v1/workspaces/me/members — list members
  app.get('/me/members', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.user

    const members = await db.select({
      userId:   workspaceMembers.userId,
      role:     workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))

    return success(reply, members)
  })
}
