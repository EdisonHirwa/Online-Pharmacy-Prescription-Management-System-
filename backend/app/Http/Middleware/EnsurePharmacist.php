<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePharmacist
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()->role !== 'pharmacist') {
            AuditService::record('unauthorized_access', 'pharmacy', null, 'Attempt to access a pharmacist endpoint.');
            abort(403, 'Pharmacist access is required.');
        }

return $next($request);
    }
}
