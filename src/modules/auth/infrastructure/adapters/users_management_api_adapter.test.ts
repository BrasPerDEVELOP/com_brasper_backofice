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
import {
  createUser,
  fetchUsers,
  fetchUserFilterOptions,
  updateUser
} from './users_management_api_adapter'

const get = vi.mocked(apiClient.get)
const post = vi.mocked(apiClient.post)
const put = vi.mocked(apiClient.put)

describe('users management api adapter', () => {
  it('crea clientes distintos con el mismo correo sin asignarles acceso implícito', async () => {
    get.mockResolvedValue({ data: [{ id: 'old', names: 'Ana', email: 'familia@example.com', role: 'client' }] })
    post.mockResolvedValue({ data: { id: 'new', names: 'Pedro', email: 'familia@example.com', role: 'client' } })
    const user = await createUser({ names: 'Pedro', email: 'familia@example.com', role: 'client' })
    expect(user.id).toBe('new')
    const form = post.mock.calls[0]?.[1] as FormData
    expect(form.get('email')).toBe('familia@example.com')
    expect(form.has('password')).toBe(false)
    expect(put).not.toHaveBeenCalled()
  })

  it('propaga un conflicto de correo sin sustituir al cliente por otro', async () => {
    get.mockResolvedValue({ data: [{ id: 'old', names: 'Ana', email: 'familia@example.com', role: 'client' }] })
    post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { detail: 'Email already exists' } } })
    await expect(createUser({ names: 'Pedro', email: 'familia@example.com', role: 'client' })).rejects.toThrow('Email already exists')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('conserva la contraseña explícita y el alta de acceso para personal', async () => {
    post.mockResolvedValue({ data: { id: 'staff', names: 'Vendedor', role: 'sales' } })
    await createUser({ names: 'Vendedor', email: 'staff@example.com', role: 'sales' })
    expect((post.mock.calls[0]?.[1] as FormData).get('password')).toBeTruthy()
    await createUser({ names: 'Cliente', email: 'cliente@example.com', role: 'client', password: 'Explicit123!' })
    expect((post.mock.calls[1]?.[1] as FormData).get('password')).toBe('Explicit123!')
  })

  it('envía país, rol y búsqueda al backend sin filtrar su respuesta', async () => {
    get.mockResolvedValueOnce({
      data: [{ id: 'server-user', names: 'Respuesta del servidor', country: 'Brasil' }]
    })
    const users = await fetchUsers({ country: 'brasil', role: 'client', search: 'Adela' })
    expect(get).toHaveBeenCalledWith(
      'https://api.test/user',
      expect.objectContaining({ params: { country: 'brasil', role: 'client', search: 'Adela' } })
    )
    expect(users.map((u) => u.id)).toEqual(['server-user'])
  })

  it('consulta las opciones de país en la API', async () => {
    get.mockResolvedValueOnce({ data: { countries: ['Brasil', 'Perú'] } })
    expect(await fetchUserFilterOptions('client')).toEqual(['Brasil', 'Perú'])
    expect(get).toHaveBeenCalledWith(
      'https://api.test/user/filter-options',
      expect.objectContaining({ params: { role: 'client' } })
    )
  })
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
      () =>
        new Promise((resolve) => {
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

  it('envía el rol seleccionado al editar un usuario', async () => {
    put.mockResolvedValue({
      data: { id: 'u1', names: 'Ana', role: 'sales' }
    })

    await updateUser({ id: 'u1', role: 'sales' })

    const form = put.mock.calls[0]?.[1] as FormData
    expect(form.get('id')).toBe('u1')
    expect(form.get('role')).toBe('sales')
  })
})
