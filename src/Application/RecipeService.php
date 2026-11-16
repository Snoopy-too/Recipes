<?php
declare(strict_types=1);

namespace App\Application;

use App\Domain\RecipeRepositoryInterface;

final class RecipeService
{
    private RecipeRepositoryInterface $repository;

    public function __construct(RecipeRepositoryInterface $repository)
    {
        $this->repository = $repository;
    }

    /**
     * @return array{
     *     recipes: array<int, array<string, mixed>>,
     *     categories: array<string, array{id: string, label: string, count: int}>,
     *     total: int
     * }
     */
    public function getCatalog(): array
    {
        $recipes = $this->repository->findAll();
        $categories = [];

        foreach ($recipes as $recipe) {
            $catId = (string) ($recipe['category'] ?? 'uncategorized');
            $catLabel = (string) ($recipe['categoryLabel'] ?? 'Uncategorized');

            if (!isset($categories[$catId])) {
                $categories[$catId] = [
                    'id' => $catId,
                    'label' => $catLabel,
                    'count' => 0,
                ];
            }
            $categories[$catId]['count']++;
        }

        return [
            'recipes' => $recipes,
            'categories' => $categories,
            'total' => count($recipes),
        ];
    }

    public function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
