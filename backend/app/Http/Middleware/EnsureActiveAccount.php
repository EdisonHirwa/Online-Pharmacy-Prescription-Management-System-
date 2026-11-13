<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->account_status !== 'active') {
            $request->user()?->tokens()->delete();
            abort(401, 'Your account is inactive. Contact an administrator.');
        }

        return $next($request);
    }
}
