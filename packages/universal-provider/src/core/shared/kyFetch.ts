import ky from 'ky'

export const kyFetch = ky.extend({
  fetch: async (input, init) => fetch(
    input,
    input instanceof Request && input.body && (init as any)?.duplex === undefined
      ? { ...(init as any), duplex: 'half' }
      : init,
  ),
})
