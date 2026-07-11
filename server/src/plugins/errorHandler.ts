import { FastifyInstance, FastifyError } from 'fastify';
import { Prisma } from '@prisma/client';

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.status(409).send({ success: false, error: 'Duplicate record exists.' });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({ success: false, error: 'Record not found.' });
      }
      return reply.status(400).send({ success: false, error: 'Database error.' });
    }

    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message || 'An error occurred.',
      });
    }

    return reply.status(500).send({ success: false, error: 'Internal server error.' });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ success: false, error: 'Route not found.' });
  });
}
