/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { createComment } from '../create_comment';
import { comment } from '../comment';

export const importComment = t.union([comment, createComment]);

export type ImportComment = t.TypeOf<typeof importComment>;
export const importCommentsArray = t.array(importComment);
export type ImportCommentsArray = t.TypeOf<typeof importCommentsArray>;
export const importCommentsArrayOrUndefined = t.union([importCommentsArray, t.undefined]);
export type ImportCommentsArrayOrUndefined = t.TypeOf<typeof importCommentsArrayOrUndefined>;
