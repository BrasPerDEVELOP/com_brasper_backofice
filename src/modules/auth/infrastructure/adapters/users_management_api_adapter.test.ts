import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/interface/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}))

vi.mock('@/interface/infrastructure/services', () => ({
  Domain: { apiPath: (path: string) => `https://api.test/${path}` }
}))

import { apiClient } from '@/interface/api/client'
import { createUser, fetchUsers } from './users_management_api_adapter'

const get = vi.mocked(apiClient.get)
const post = vi.mocked(apiClient.post)
const put = vi.mocked(apiClient.put)

describe('users management api adapter', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
    get.mockResolvedValue({ data: [] })
  })

  it('incorpora una sola fila por id y conserva la representación más completa', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'u1', names: 'Rubén Gregorio Moreno Moreno', role: 'client' },
        {
          id: 'u1',
          names: 'Rubén Gregorio Moreno Moreno',
          email: 'demo594@gmail.com',
          role: 'client'
        }
      ]
    })

    const users = await fetchUsers()

    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({ id: 'u1', email: 'demo594@gmail.com' })
  })

  it('conserva usuarios distintos aunque compartan el mismo nombre', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'u1', names: 'Rubén Moreno', role: 'client' },
        { id: 'u2', names: 'Rubén Moreno', email: 'otro@example.com', role: 'client' }
      ]
    })

    const users = await fetchUsers()

    expect(users.map((user) => user.id)).toEqual(['u1', 'u2'])
  })

  it('comparte un único POST entre creaciones idénticas concurrentes', async () => {
    let resolvePost!: (value: { data: unknown }) => void
    post.mockImplementation(
      () => new Promise((resolve) => {
        resolvePost = resolve
      })
    )
    const payload = {
      names: 'Rubén Moreno',
      email: 'ruben@example.com',
      role: 'client'
    }

    const first = createUser(payload)
    const second = createUser({ ...payload })

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    resolvePost({
      data: { id: 'u1', names: 'Rubén Moreno', email: 'ruben@example.com', role: 'client' }
    })

    const [firstUser, secondUser] = await Promise.all([first, second])
    expect(firstUser.id).toBe('u1')
    expect(secondUser).toEqual(firstUser)
  })

  it('completa por PUT el cliente único creado rápidamente en Transacciones', async () => {
    get.mockResolvedValue({
      data: [{ id: 'quick-1', names: 'Rubén Gregorio Moreno Moreno', role: 'client' }]
    })
    put.mockResolvedValue({
      data: {
        id: 'quick-1',
        names: 'Rubén Gregorio Moreno Moreno',
        email: 'ruben@example.com',
        role: 'client'
      }
    })

    const user = await createUser({
      names: 'Ruben Gregorio Moreno Moreno',
      email: 'ruben@example.com',
      role: 'client'
    })

    expect(post).not.toHaveBeenCalled()
    expect(put).toHaveBeenCalledTimes(1)
    expect(user).toMatchObject({ id: 'quick-1', email: 'ruben@example.com' })
    const form = put.mock.calls[0]?.[1] as FormData
    expect(form.get('id')).toBe('quick-1')
  })

  it('bloquea la fusión automática cuando hay homónimos incompletos', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'quick-1', names: 'Alex López', role: 'client' },
        { id: 'quick-2', names: 'Alex Lopez', role: 'client' }
      ]
    })

    await expect(
      createUser({ names: 'Álex López', email: 'alex@example.com', role: 'client' })
    ).rejects.toThrow('más de un cliente incompleto')
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })
})
