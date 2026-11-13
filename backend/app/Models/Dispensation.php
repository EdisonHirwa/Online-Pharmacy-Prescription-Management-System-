<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dispensation extends Model
{
    protected $hidden = ['request_key', 'request_hash'];

    public function items(): HasMany
    {
        return $this->hasMany(DispensationItem::class);
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(Prescription::class);
    }

    public function pharmacist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pharmacist_id');
    }

    protected $table = 'dispensations';

    protected $guarded = ['id'];
}
