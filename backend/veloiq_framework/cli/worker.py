"""``veloiq worker`` — unified async task queue worker CLI.

The framework itself has no job queue of its own — this command delegates
to whichever installed extension provides the actual worker loop. Today
that's Advanced Development's ``jobs`` module
(``advanced_development.modules.jobs.worker``): a durable, DB-backed queue
with exponential-backoff retry, a dead-letter queue, and multi-node SSE fan-
out for its Job Queue Dashboard. Extension packages (or a host app's own
modules) register handlers against that same queue — either directly via
``worker.register_handler(job_type, handler)``, or via the ergonomic
``@background_task`` decorator (``advanced_development.modules.jobs.
decorators``) — during the normal app-startup path (each installed
extension's ``factory.py``, or simply importing the module that defines a
``@background_task``-decorated function).

This command gives that worker loop one canonical, framework-level
entrypoint (``veloiq worker start``) instead of requiring every host app to
remember an extension-specific subcommand name
(``advanced-development worker start``, which still works as a direct
alias — see that package's ``cli/worker_cmds.py``). If Advanced Development
isn't installed, this prints a clear message rather than a raw
``ImportError`` traceback.
"""
from __future__ import annotations

import click


@click.group()
def worker():
    """Background async task queue worker commands."""
    pass


@worker.command("start")
@click.option("--poll-interval", default=1.0, type=float, help="Seconds between DB polls when idle.")
@click.option("--max-iterations", default=None, type=int, help="Stop after N claim attempts (testing only).")
def start(poll_interval: float, max_iterations: int | None):
    """Start polling for and executing queued background jobs. Blocks until interrupted.

    Must be run from the host app's backend directory (or with DATABASE_URL
    set) so the worker resolves the same database the web app uses — a
    worker is a separate OS process from the web app, not a background
    thread inside it.
    """
    try:
        from advanced_development.modules.jobs.worker import start_worker_process
    except ImportError:
        click.echo(
            "❌ `veloiq worker` requires the Advanced Development extension "
            "for its job queue:\n"
            "     pip install advanced-development\n"
            "     veloiq extend-package advanced_development\n"
            "No background-job worker is available without it.",
            err=True,
        )
        raise SystemExit(1)

    click.echo(f"Starting VeloIQ background job worker (poll_interval={poll_interval}s)...")
    start_worker_process(poll_interval=poll_interval, max_iterations=max_iterations)
