<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureLaboratoryTechnician
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()->role !== 'lab_tech') {
            AuditService::record('unauthorized_access', 'laboratory', null, 'Attempt to access a laboratory technician endpoint.');
            abort(403, 'Laboratory technician access is required.');
        }

        return $next($request);
    }
}
