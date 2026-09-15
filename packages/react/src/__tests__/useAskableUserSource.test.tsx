import { useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableUserSource } from '../useAskableUserSource.js';
import type { AskableUserProfile, UseAskableUserSourceOptions } from '../useAskableUserSource.js';

const USER: AskableUserProfile = {
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'admin',
  plan: 'enterprise',
};

describe('useAskableUserSource', () => {
  it('registers under "user" id by default', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: USER });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('user');
      expect(resolved.id).toBe('user');
      expect(resolved.kind).toBe('user');
    });

    ctx.destroy();
  });

  it('exposes user profile fields', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: USER });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('user');
      const data = resolved.data as AskableUserProfile;
      expect(data.name).toBe('Alice Admin');
      expect(data.role).toBe('admin');
    });

    ctx.destroy();
  });

  it('accepts a function as user', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: () => USER });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('user');
      expect((resolved.data as AskableUserProfile).name).toBe('Alice Admin');
    });

    ctx.destroy();
  });

  it('omits specified fields', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: USER, omitFields: ['email'] });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('user');
      expect((resolved.data as AskableUserProfile).email).toBeUndefined();
      expect((resolved.data as AskableUserProfile).name).toBe('Alice Admin');
    });

    ctx.destroy();
  });

  it('reflects null user as null data', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: null });
      return null;
    }

    render(<Consumer />);

    await waitFor(async () => {
      const resolved = await ctx.resolveSource('user');
      expect(resolved.data).toBeNull();
    });

    ctx.destroy();
  });

  it('updates when user changes', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      const [user, setUser] = useState<AskableUserProfile | null>(null);
      useAskableUserSource({ ctx, user });
      return (
        <button data-testid="login" onClick={() => setUser(USER)} />
      );
    }

    const { getByTestId } = render(<Consumer />);

    await waitFor(async () => {
      const r = await ctx.resolveSource('user');
      expect(r.data).toBeNull();
    });

    act(() => getByTestId('login').click());

    await waitFor(async () => {
      const r = await ctx.resolveSource('user');
      expect((r.data as AskableUserProfile).name).toBe('Alice Admin');
    });

    ctx.destroy();
  });

  it('unregisters on unmount', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: USER });
      return null;
    }

    const view = render(<Consumer />);

    await waitFor(async () => {
      await expect(ctx.resolveSource('user')).resolves.toMatchObject({ id: 'user' });
    });

    view.unmount();
    await expect(ctx.resolveSource('user')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('respects the enabled flag', async () => {
    const ctx = createAskableContext();

    function Consumer() {
      useAskableUserSource({ ctx, user: USER, enabled: false });
      return null;
    }

    render(<Consumer />);
    await expect(ctx.resolveSource('user')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it('uses a replacement sanitizer without leaking synthetic data or re-registering', async () => {
    const ctx = createAskableContext();
    const register = vi.spyOn(ctx, 'registerSource');
    const secret = 'synthetic-user-secret';
    const user = { name: 'Test user', privateNote: secret };

    function Consumer({ sanitize }: Pick<UseAskableUserSourceOptions, 'sanitize'>) {
      useAskableUserSource({ ctx, user, sanitize });
      return null;
    }

    const view = render(<Consumer sanitize={(profile) => profile} />);
    expect((await ctx.resolveSource('user')).data).toMatchObject({ privateNote: secret });

    view.rerender(<Consumer sanitize={() => ({ name: 'Test user', privateNote: '[redacted]' })} />);
    const resolved = await ctx.resolveSource('user');
    expect(resolved.data).toEqual({ name: 'Test user', privateNote: '[redacted]' });
    expect(JSON.stringify(resolved)).not.toContain(secret);
    const prompt = await ctx.toPromptContextAsync({ sources: ['user'] });
    expect(prompt).toContain('[redacted]');
    expect(prompt).not.toContain(secret);
    expect(register).toHaveBeenCalledTimes(1);

    view.unmount();
    await expect(ctx.resolveSource('user')).rejects.toThrow('not registered');
    ctx.destroy();
  });

  it.each([
    {
      option: 'describe',
      initial: { describe: () => 'Initial user' },
      replacement: { describe: async () => 'Updated user' },
      initialExpected: { description: 'Initial user' },
      replacementExpected: { description: 'Updated user' },
    },
    {
      option: 'sanitize',
      initial: { sanitize: () => ({ name: 'Redacted' }) },
      replacement: { sanitize: () => ({ name: 'Updated user' }) },
      initialExpected: { data: { name: 'Redacted' } },
      replacementExpected: { data: { name: 'Updated user' } },
    },
    {
      option: 'user',
      initial: { user: () => ({ name: 'Initial user' }) },
      replacement: { user: async () => ({ name: 'Updated user' }) },
      initialExpected: { data: { name: 'Initial user' } },
      replacementExpected: { data: { name: 'Updated user' } },
    },
  ])('supports adding, replacing, and removing $option callbacks without re-registering', async ({
    initial, replacement, initialExpected, replacementExpected,
  }) => {
    const ctx = createAskableContext();
    const register = vi.spyOn(ctx, 'registerSource');

    function Consumer(options: Pick<UseAskableUserSourceOptions, 'describe' | 'sanitize' | 'user'>) {
      useAskableUserSource({ ctx, user: USER, ...options });
      return null;
    }

    const view = render(<Consumer />);
    view.rerender(<Consumer {...initial} />);
    expect(await ctx.resolveSource('user')).toMatchObject(initialExpected);

    view.rerender(<Consumer {...replacement} />);
    expect(await ctx.resolveSource('user')).toMatchObject(replacementExpected);

    view.rerender(<Consumer />);
    expect(await ctx.resolveSource('user')).toMatchObject({
      description: 'Logged-in user', data: USER,
    });
    expect(register).toHaveBeenCalledTimes(1);

    view.unmount();
    ctx.destroy();
  });
});
