/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { errors } from '@elastic/elasticsearch';

/**
 * An unauthorized (401) error returned by elasticsearch
 * @public
 */
export type UnauthorizedError = errors.ResponseError & {
  statusCode: 401;
};

/**
 * Checks if the provided `error` is an {@link errors.ResponseError | elasticsearch response error}
 * @public
 */
export function isResponseError(error: unknown): error is errors.ResponseError {
  return error instanceof errors.ResponseError;
}

export function isNotFoundError(
  error: unknown
): error is errors.ResponseError & { statusCode: 404 } {
  return isResponseError(error) && error.statusCode === 404;
}

/**
 * Checks if the provided `error` is an {@link UnauthorizedError | elasticsearch unauthorized error}
 * @public
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return isResponseError(error) && error.statusCode === 401;
}

/**
 * Checks if the provided `error` is an {@link errors.RequestAbortedError | elasticsearch request aborted error}
 * @public
 */
export function isRequestAbortedError(error: unknown): error is errors.RequestAbortedError {
  return error instanceof errors.RequestAbortedError;
}

export function isMaximumResponseSizeExceededError(
  error: unknown
): error is errors.RequestAbortedError {
  return isRequestAbortedError(error) && error.message.includes('content length');
}
