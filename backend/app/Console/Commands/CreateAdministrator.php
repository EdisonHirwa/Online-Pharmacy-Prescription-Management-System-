<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CreateAdministrator extends Command
{
    protected $signature = 'admin:create {email} {--name=Hospital Administrator} {--phone=}';

    protected $description = 'Create an administrator with a generated password; never overwrites an existing account.';

    public function handle(): int
    {
        $data = ['email' => strtolower(trim($this->argument('email'))), 'name' => $this->option('name'), 'phone_number' => $this->option('phone')];
        $validator = Validator::make($data, ['email' => 'required|email|unique:users,email', 'name' => 'required|string|max:255', 'phone_number' => ['required', 'regex:/^\\+?[0-9]{9,15}$/', 'unique:users,phone_number']]);
        if ($validator->fails()) {
            $this->error($validator->errors()->first());

            return self::FAILURE;
        }
        $password = Str::password(20);
        User::create($data + ['password' => $password, 'role' => 'admin', 'account_status' => 'active']);
        $this->info('Administrator created: '.$data['email']);
        $this->line('Initial password (save it now): '.$password);

        return self::SUCCESS;
    }
}
