'use client';

import { useState } from 'react';

export function TaskForm() {
  const [name, setName] = useState('');
  const [cron, setCron] = useState('');
  const [instruction, setInstruction] = useState('');
  const [workingDir, setWorkingDir] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cron, instruction, workingDir })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create task');
      }

      setStatus('Task created.');
      setName('');
      setCron('');
      setInstruction('');
      setWorkingDir('');
    } catch (error: any) {
      setStatus(error.message || 'Failed to create task.');
    }
  };

  return (
    <form onSubmit={submit} className="panel rounded-2xl p-5">
      <h3 className="text-lg font-semibold">Create Task</h3>
      <div className="mt-4 grid gap-3">
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Task name"
          className="rounded-xl border border-line bg-white/80 px-4 py-2 text-sm"
          required
        />
        <input
          value={cron}
          onChange={event => setCron(event.target.value)}
          placeholder="Cron (e.g. 0 12 * * *)"
          className="rounded-xl border border-line bg-white/80 px-4 py-2 text-sm"
          required
        />
        <input
          value={workingDir}
          onChange={event => setWorkingDir(event.target.value)}
          placeholder="Working directory"
          className="rounded-xl border border-line bg-white/80 px-4 py-2 text-sm"
          required
        />
        <textarea
          value={instruction}
          onChange={event => setInstruction(event.target.value)}
          placeholder="Instruction"
          className="min-h-[100px] rounded-xl border border-line bg-white/80 px-4 py-2 text-sm"
          required
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{status || 'Define tasks in natural language.'}</span>
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
        >
          Save
        </button>
      </div>
    </form>
  );
}
