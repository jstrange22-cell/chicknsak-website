import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  X,
  FolderOpen,
  Image,
  Tag as TagIcon,
  Clock,
  Trash2,
} from 'lucide-react';
import { useSearch, getRecentSearches, addRecentSearch, clearRecentSearches } from '@/hooks/useSearch';
import { cn } from '@/lib/utils';

export default function Search() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(getRecentSearches());

  const { data: results, isLoading } = useSearch(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (term: string) => {
    setQuery(term);
    if (term.length >= 2) {
      addRecentSearch(term);
      setRecentSearches(getRecentSearches());
    }
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const hasResults = results && (results.projects.length > 0 || results.photos.length > 0 || results.tags.length > 0);

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search projects, photos, and tags..."
          className="w-full pl-10 pr-10 py-3 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Recent searches */}
      {!query && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Recent Searches
            </h3>
            <button
              onClick={handleClearRecent}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                className="px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-600 hover:bg-slate-200"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && query.length >= 2 && (
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-slate-400 mt-2">Searching...</p>
        </div>
      )}

      {/* Empty state */}
      {!query && recentSearches.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Search projects, photos, and tags</p>
          <p className="text-sm text-slate-400 mt-1">Start typing to find what you need</p>
        </div>
      )}

      {/* No results */}
      {query.length >= 2 && !isLoading && !hasResults && (
        <div className="text-center py-12">
          <SearchIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No results found</p>
          <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-6">
          {results.projects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" />
                Projects ({results.projects.length})
              </h3>
              <div className="space-y-1">
                {results.projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-xl hover:bg-slate-50 text-left border border-slate-100"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{project.name}</p>
                      {project.addressFull && (
                        <p className="text-xs text-slate-500 truncate">{project.addressFull}</p>
                      )}
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                      project.status === 'active' && "bg-emerald-100 text-emerald-700",
                      project.status === 'completed' && "bg-blue-100 text-blue-700",
                      project.status === 'on_hold' && "bg-amber-100 text-amber-700",
                      project.status === 'archived' && "bg-slate-100 text-slate-700"
                    )}>
                      {project.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.photos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <Image className="w-4 h-4" />
                Photos ({results.photos.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {results.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => navigate(`/projects/${photo.projectId}`)}
                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-100"
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.description || 'Photo'}
                      className="w-full h-full object-cover"
                    />
                    {photo.description && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        <p className="text-[10px] text-white truncate">{photo.description}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <TagIcon className="w-4 h-4" />
                Tags ({results.tags.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.tags.map((tag) => (
                  <button
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white hover:opacity-80"
                    style={{ backgroundColor: tag.color }}
                  >
                    <TagIcon className="w-3.5 h-3.5" />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
