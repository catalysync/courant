import { CategoriesSection } from "../sections/categories-section";
import { ResultsSection } from "../sections/results-section";

interface SearchViewProps {
  categoryId?: string;
  query?: string;
}

export const SearchView = ({ categoryId, query }: SearchViewProps) => {
  const hasQuery = !!query?.trim();

  return (
    <div className="max-w-[1300px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
      <CategoriesSection categoryId={categoryId} />
      {!hasQuery && (
        <p className="text-sm text-muted-foreground">
          Search titles and descriptions.
        </p>
      )}
      <ResultsSection query={query} categoryId={categoryId} />
    </div>
  );
};
