import type { $Fetch } from 'ofetch'

class HttpFactory {
  private $fetch: $Fetch
  private baseURL: string

  constructor(fetcher: $Fetch, baseURL: string) {
    this.$fetch = fetcher
    this.baseURL = baseURL
  }

  async call<T>(
    method: 'GET' | 'POST',
    path: string,
    data?: object,
    extras: Record<string, unknown> = {},
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`

    return await this.$fetch<T>(url, {
      method,
      body: data,
      ...extras,
    })
  }
}

export default HttpFactory
