<?php
declare(strict_types=1);

namespace App\Infrastructure;

use App\Domain\RecipeRepositoryInterface;
use RuntimeException;

final class JsonRecipeRepository implements RecipeRepositoryInterface
{
    private string $filePath;

    /** @var array<int, array<string, mixed>>|null */
    private ?array $cache = null;

    public function __construct(string $filePath)
    {
        $this->filePath = $filePath;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function findAll(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        if (!is_file($this->filePath) || !is_readable($this->filePath)) {
            throw new RuntimeException('Recipe data file is missing or unreadable.');
        }

        $raw = file_get_contents($this->filePath);
        if ($raw === false) {
            throw new RuntimeException('Failed to read recipe data file.');
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid JSON format in recipe data file.');
        }

        $recipes = [];
        foreach ($decoded as $item) {
            if (is_array($item) && isset($item['id'], $item['title'])) {
                $recipes[] = $item;
            }
        }

        $this->cache = $recipes;
        return $this->cache;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(string $id): ?array
    {
        foreach ($this->findAll() as $recipe) {
            if ((string) ($recipe['id'] ?? '') === $id) {
                return $recipe;
            }
        }
        return null;
    }
}
