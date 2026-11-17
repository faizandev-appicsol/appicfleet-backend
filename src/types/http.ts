export type ValidatedRequestData = {
  body?: unknown
  query?: unknown
  params?: unknown
  headers?: unknown
}

export type ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  THeaders = unknown,
> = {
  body: TBody
  query: TQuery
  params: TParams
  headers: THeaders
}
