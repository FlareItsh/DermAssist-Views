# API Usage Guide

This project uses custom helpers to simplify fetching data from the Laravel backend.

## Configuration

The API base URL is managed via the `.env` file:

```env
NUXT_PUBLIC_API_BASE=http://localhost:8000/api
```

## Available Helpers

We have two main helpers located in `app/composables/useApi.ts`:

### 1. `useApi(url, options)`

A wrapper around Nuxt's `useFetch`. Use this for **SSR-friendly data fetching** on page load.

- Returns reactive `data`, `pending`, `error`, and `refresh`.
- **Auto-imports**: You don't need to import it.

**Example (GET on page load):**

```vue
<script setup lang="ts">
  const { data, pending, error } = await useApi('users')
</script>
```

### 2. `$api(url, options)`

A wrapper around Nuxt's `$fetch`. Use this for **imperative/client-side actions** (e.g., button clicks, form submissions).

- Returns a Promise that resolves to the data.
- **Auto-imports**: You don't need to import it.

**Example (POST on button click):**

```vue
<script setup lang="ts">
  const submitForm = async () => {
    try {
      const result = await $api('users', {
        method: 'POST',
        body: { name: 'John Doe' }
      })
      console.log('Success:', result)
    } catch (err) {
      console.error('Failed:', err)
    }
  }
</script>
```

## HTTP Methods Examples

### GET

```typescript
const { data } = await useApi('posts')
```

### POST

```typescript
await $api('posts', {
  method: 'POST',
  body: { title: 'New Post', content: '...' }
})
```

### PUT / PATCH

```typescript
await $api('posts/1', {
  method: 'PUT',
  body: { title: 'Updated Title' }
})
```

### DELETE

```typescript
await $api('posts/1', {
  method: 'DELETE'
})
```

## Tips

- **No leading slash**: You don't need a leading slash in the URL if it's relative to the base URL (e.g., use `users` instead of `/users`).
- **Options**: You can pass any `useFetch` or `$fetch` options to these helpers.
