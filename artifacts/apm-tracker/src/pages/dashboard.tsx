import { useState, useMemo } from 'react';
import { Search, RefreshCw, Loader2 } from 'lucide-react';
import {
  useListJobs,
  useListCompanies,
  useGetJobStats,
  useRefreshJobs,
  getListJobsQueryKey,
  getListCompaniesQueryKey,
  getGetJobStatsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JobList } from '@/components/job-list';
import { StatsBar } from '@/components/stats-bar';
import { CompanyGrid } from '@/components/company-grid';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobs, isLoading: jobsLoading } = useListJobs(
    selectedCompany ? { company: selectedCompany, q: searchQuery || undefined } : { q: searchQuery || undefined }
  );

  const { data: companies, isLoading: companiesLoading } = useListCompanies();
  const { data: stats, isLoading: statsLoading } = useGetJobStats();

  const refreshMutation = useRefreshJobs({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetJobStatsQueryKey() });

        if (result.errors.length > 0) {
          toast({
            title: 'Refresh completed with errors',
            description: `${result.totalJobs} jobs found from ${result.companiesChecked} companies. ${result.errors.length} companies failed.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Data refreshed',
            description: `${result.totalJobs} jobs found from ${result.companiesChecked} companies.`,
          });
        }
      },
      onError: () => {
        toast({
          title: 'Refresh failed',
          description: 'Unable to refresh job listings. Please try again.',
          variant: 'destructive',
        });
      },
    },
  });

  const handleCompanyClick = (slug: string) => {
    setSelectedCompany((current) => (current === slug ? null : slug));
  };

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  const displayedJobs = useMemo(() => jobs || [], [jobs]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                APM <span className="text-primary">Radar</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track {companies?.length || 21} APM/RPM programs in real-time
              </p>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              size="sm"
              className="gap-2"
              data-testid="button-refresh-jobs"
            >
              {refreshMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} isLoading={statsLoading} />

        {/* Company Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Companies</h2>
          <CompanyGrid
            companies={companies || []}
            onCompanyClick={handleCompanyClick}
            selectedCompany={selectedCompany}
            isLoading={companiesLoading}
          />
        </div>

        {/* Search & Job List */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search job titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-jobs"
              />
            </div>
            {selectedCompany && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompany(null)}
                data-testid="button-clear-company-filter"
              >
                Clear filter
              </Button>
            )}
          </div>

          <JobList jobs={displayedJobs} isLoading={jobsLoading} />
        </div>
      </main>
    </div>
  );
}
