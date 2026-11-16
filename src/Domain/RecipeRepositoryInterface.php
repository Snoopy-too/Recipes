<?php
declare(strict_types=1);

namespace App\Domain;

interface RecipeRepositoryInterface
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array;

    /**
     * @return array<string, mixed>|null
     */
    public function findById(string $id): ?array;
}
