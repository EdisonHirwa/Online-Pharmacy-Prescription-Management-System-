<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdministrator
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! Gate::allows('manage-hospital')) {
            AuditService::record('unauthorized_access', 'admin', null, 'Attempt to access an administrator endpoint.');
            abort(403, 'Administrator access is required.');
        }

        return $next($request);
    }
}
