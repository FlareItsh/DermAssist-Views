# API & Assets Guide

This guide covers how to interact with the DermAssist API and handle media assets using our custom Nuxt composables.

---

## 🔐 Authentication

Our API helpers automatically handle authentication. When a user logs in, an `auth_token` cookie is stored. This token is then automatically injected into every request.

- **Storage**: `auth_token` cookie.
- **Header**: `Authorization: Bearer <token>`
- **Behavior**: If the cookie is missing, the header is omitted.

---

## 🚀 API Helpers

We use two primary wrappers located in `app/composables/useApi.ts`. Both use the `NUXT_PUBLIC_API_BASE` from your `.env`.

### 1. `useApi(url, options)`

A wrapper around Nuxt's `useFetch`. Best for **SSR-friendly data fetching** on page load.

> [!TIP]
> Use a **getter function** for the URL to make the fetch reactive to state changes.

**Static Example:**

```vue
<script setup lang="ts">
  // Fetches once on mount
  const { data, pending } = await useApi('appointments')
</script>
```

**Reactive Example:**

```vue
<script setup lang="ts">
  const page = ref(1)

  // Re-fetches automatically whenever 'page' changes
  const { data } = await useApi(() => `appointments?page=${page.value}`)
</script>
```

### 2. `$api(url, options)`

A wrapper around Nuxt's `$fetch`. Use this for **imperative actions** like form submissions or manual refreshes.

**Example (POST Action):**

```vue
<script setup lang="ts">
  const submitData = async () => {
    try {
      const result = await $api('verify', {
        method: 'POST',
        body: { status: 'approved' }
      })
      // Handle success
    } catch (err) {
      // Handle error
    }
  }
</script>
```

---

## 🖼️ Handling Assets

To display images stored on the backend, use the `useStorage` composable. It resolves the full URL using `NUXT_PUBLIC_STORAGE_BASE`.

### `getStorageUrl(path)`

- **Input**: Relative path from the backend (e.g., `avatars/user_1.jpg`)
- **Output**: Full absolute URL or empty string if path is null.

**Example:**

```vue
<script setup lang="ts">
  const { getStorageUrl } = useStorage()
  const avatarPath = 'profiles/image.jpg'
</script>

<template>
  <img
    :src="getStorageUrl(avatarPath)"
    alt="Profile"
  />
</template>
```

---

## 🛠️ RESTful Actions

Here is how to perform standard CRUD operations using our helpers.

### GET (Read)

Use `useApi` for data that should be available on page load, or `$api` for on-demand fetching.

```typescript
// On page load
const { data: users } = await useApi('users')

// On demand
const fetchUser = async id => {
  const user = await $api(`users/${id}`)
}
```

### POST (Create)

Always use `$api` for actions that mutate data.

```typescript
const createUser = async userData => {
  await $api('users', {
    method: 'POST',
    body: userData
  })
}
```

### PUT / PATCH (Update)

Use `PUT` for full updates or `PATCH` for partial updates.

```typescript
const updateUser = async (id, updates) => {
  await $api(`users/${id}`, {
    method: 'PUT',
    body: updates
  })
}
```

### DELETE (Destroy)

```typescript
const deleteUser = async id => {
  await $api(`users/${id}`, {
    method: 'DELETE'
  })
}
```

---

## 🔧 Common Patterns

### Query Parameters

Pass parameters using the `query` option to ensure proper encoding.

```typescript
const { data } = await useApi('search', {
  query: { q: 'eczema', limit: 10 }
})
```

### Error Handling

Our helpers throw standard Nuxt fetch errors. You can catch them or use the `error` ref from `useApi`.

```typescript
const { data, error } = await useApi('profile')

if (error.value) {
  console.error('Status:', error.value.statusCode)
  console.error('Message:', error.value.data?.message)
}
```

---

## 💡 Best Practices

1. **No Leading Slashes**: Use `users` instead of `/users`.
2. **Type Safety**: Provide types for better DX: `useApi<User[]>('users')`.
3. **Environment**: Ensure `NUXT_PUBLIC_API_BASE` is correctly set in `.env`.
