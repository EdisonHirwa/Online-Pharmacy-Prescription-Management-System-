<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrescriptionItem extends Model
{
    protected $table = 'prescription_items';

    protected $guarded = ['id'];

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function dispensationItems(): HasMany
    {
        return $this->hasMany(DispensationItem::class);
    }

    protected function casts(): array
    {
        return ['unit_price' => 'decimal:2', 'quantity' => 'integer'];
    }
}
